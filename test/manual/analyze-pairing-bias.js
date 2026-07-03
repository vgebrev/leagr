#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Detect ELO/pot-seeding bias that structurally suppresses specific player pairings.
 *
 * For every pair of players, compares actual same-team pairings against two null models,
 * per co-attended session:
 *   - Null A (fully random teams):    P = Σ_teams s_j(s_j-1) / N(N-1)
 *   - Null B (pot-respecting random): keep that day's pots and per-team pot quotas,
 *     randomly permute pot members across teams.
 *       same pot:       P = Σ_j c_j(c_j-1) / p(p-1)
 *       different pots: P = Σ_j c1_j·c2_j / (p1·p2)
 *     where c_j = players that pot actually sent to team j.
 *
 * A pair suppressed under Null A but consistent with Null B is explained by pot
 * structure alone. A pair suppressed even under Null B points at the ELO-spread
 * norm choosing complementary (high+low) picks within a pot.
 *
 * The rank-gap fingerprint makes that attribution direct: for same-pot co-attendances,
 * observed pairing rate is bucketed by within-pot ELO rank gap. If adjacent ranks pair
 * far below expectation while distant ranks pair above it, the spread norm is interfering.
 *
 * Pot data comes from drawHistory.initialPots (seeded draws only).
 *
 * Usage: node test/manual/analyze-pairing-bias.js [leagueId] [minCoAttendance] [fromDate]
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const LEAGUE_ID = process.argv[2] || 'pirates';
const MIN_CO_ATTENDANCE = Number(process.argv[3]) || 10;
const FROM_DATE = process.argv[4] || null;

const EXAMPLE_PAIRS = [
    ['Veli', 'Princelinho'],
    ['Veli', 'Lindo'],
    ['Veli', 'Dan'],
    ['Morena', 'Lindo'],
    ['Dan', 'Xavier'],
    ['Dan', 'Mufasa']
];

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Load all sessions with teams, oldest first
 * @returns {Promise<Array<Object>>} Session records
 */
async function loadSessions() {
    const leaguePath = join('data', LEAGUE_ID);
    const files = (await readdir(leaguePath))
        .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))
        .filter((f) => !FROM_DATE || f >= FROM_DATE)
        .sort();

    const sessions = [];
    for (const file of files) {
        let data;
        try {
            data = JSON.parse(await readFile(join(leaguePath, file), 'utf8'));
        } catch {
            continue;
        }
        if (!data?.teams || Object.keys(data.teams).length === 0) continue;

        const teams = Object.values(data.teams).map((team) =>
            team.filter((p) => p && typeof p === 'string' && p.trim().length > 0)
        );
        const attendees = teams.flat();

        // Pot membership from draw history (seeded draws only), sorted by ELO descending
        let pots = null;
        const dh = data.drawHistory;
        if (dh?.method === 'seeded' && Array.isArray(dh.initialPots)) {
            pots = dh.initialPots.map((pot) =>
                [...pot.players].sort((a, b) => b.elo - a.elo).map((p) => p.name)
            );
        }

        sessions.push({ date: file.slice(0, 10), teams, attendees, pots });
    }
    return sessions;
}

/**
 * Per-session lookup structures for null-model probabilities
 * @param {Object} session - Session record
 * @returns {Object} Lookups
 */
function buildSessionLookups(session) {
    const { teams, attendees, pots } = session;
    const n = attendees.length;

    // Null A: probability any two attendees share a team under fully random draw
    const nullA = teams.reduce((sum, t) => sum + t.length * (t.length - 1), 0) / (n * (n - 1));

    const teamOf = new Map();
    teams.forEach((team, j) => team.forEach((p) => teamOf.set(p, j)));

    let potOf = null;
    let rankInPot = null;
    let potQuotas = null; // potQuotas[potIdx][teamIdx] = players that pot sent to that team
    if (pots) {
        potOf = new Map();
        rankInPot = new Map();
        potQuotas = pots.map(() => Array(teams.length).fill(0));
        pots.forEach((pot, pi) => {
            pot.forEach((name, rank) => {
                potOf.set(name, pi);
                rankInPot.set(name, rank);
                const tj = teamOf.get(name);
                if (tj !== undefined) potQuotas[pi][tj]++;
            });
        });
    }

    return { nullA, teamOf, potOf, rankInPot, potQuotas, potSizes: pots?.map((p) => p.length) };
}

/**
 * Null B probability that two players share a team given that day's pot structure
 * @returns {number|null} Probability, or null if pot info is missing for either player
 */
function nullBProbability(lookups, p1, p2) {
    const { potOf, potQuotas, potSizes } = lookups;
    if (!potOf) return null;
    const pot1 = potOf.get(p1);
    const pot2 = potOf.get(p2);
    if (pot1 === undefined || pot2 === undefined) return null;

    if (pot1 === pot2) {
        const size = potSizes[pot1];
        if (size < 2) return 0;
        const sameTeamWays = potQuotas[pot1].reduce((sum, c) => sum + c * (c - 1), 0);
        return sameTeamWays / (size * (size - 1));
    }
    const cross = potQuotas[pot1].reduce((sum, c, j) => sum + c * potQuotas[pot2][j], 0);
    return cross / (potSizes[pot1] * potSizes[pot2]);
}

/**
 * Analyze all pairs across sessions
 * @param {Array<Object>} sessions - Session records
 * @returns {{pairs: Map, gapBuckets: Object}}
 */
function analyze(sessions) {
    const pairs = new Map(); // key -> stats
    // Rank-gap fingerprint: same-pot co-attendance events bucketed by within-pot ELO rank gap
    const gapBuckets = {};

    for (const session of sessions) {
        const lookups = buildSessionLookups(session);
        const { attendees } = session;

        for (let i = 0; i < attendees.length; i++) {
            for (let j = i + 1; j < attendees.length; j++) {
                const [p1, p2] = [attendees[i], attendees[j]];
                const key = pairKey(p1, p2);
                let stats = pairs.get(key);
                if (!stats) {
                    stats = {
                        p1: key.split('|')[0],
                        p2: key.split('|')[1],
                        coAtt: 0,
                        paired: 0,
                        expA: 0,
                        probNoneA: 1,
                        coAttB: 0,
                        pairedB: 0,
                        expB: 0,
                        varB: 0,
                        probNoneB: 1,
                        samePotCount: 0,
                        rankGaps: []
                    };
                    pairs.set(key, stats);
                }

                const samePotTeam = lookups.teamOf.get(p1) === lookups.teamOf.get(p2);
                stats.coAtt++;
                if (samePotTeam) stats.paired++;
                stats.expA += lookups.nullA;
                stats.probNoneA *= 1 - lookups.nullA;

                const pB = nullBProbability(lookups, p1, p2);
                if (pB !== null) {
                    stats.coAttB++;
                    if (samePotTeam) stats.pairedB++;
                    stats.expB += pB;
                    stats.varB += pB * (1 - pB);
                    stats.probNoneB *= 1 - pB;

                    if (lookups.potOf.get(p1) === lookups.potOf.get(p2)) {
                        stats.samePotCount++;
                        const gap = Math.abs(lookups.rankInPot.get(p1) - lookups.rankInPot.get(p2));
                        stats.rankGaps.push(gap);
                        const bucket = gap >= 5 ? '5+' : String(gap);
                        gapBuckets[bucket] = gapBuckets[bucket] || {
                            events: 0,
                            paired: 0,
                            expected: 0
                        };
                        gapBuckets[bucket].events++;
                        gapBuckets[bucket].expected += pB;
                        if (samePotTeam) gapBuckets[bucket].paired++;
                    }
                }
            }
        }
    }
    return { pairs, gapBuckets };
}

/**
 * Render the HTML report
 */
function renderHtml(sessions, suppressed, examples, gapBuckets, potSessions) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const pct = (x) => `${(x * 100).toFixed(1)}%`;

    const pairRow = (s) => {
        const z = s.varB > 0 ? (s.pairedB - s.expB) / Math.sqrt(s.varB) : 0;
        const flag =
            s.probNoneB < 0.05 && s.paired === 0
                ? '<span class="badge bad">suppressed beyond pots</span>'
                : s.probNoneA < 0.05 && s.paired === 0
                  ? '<span class="badge warn">pot-structural</span>'
                  : '<span class="badge ok">ok</span>';
        return `<tr>
            <td class="player-name">${esc(s.p1)} &amp; ${esc(s.p2)}</td>
            <td>${s.coAtt}</td>
            <td>${s.paired}</td>
            <td>${s.expA.toFixed(1)}</td>
            <td>${s.expB.toFixed(1)}</td>
            <td>${s.probNoneA < 0.001 ? '&lt;0.001' : s.probNoneA.toFixed(3)}</td>
            <td>${s.probNoneB < 0.001 ? '&lt;0.001' : s.probNoneB.toFixed(3)}</td>
            <td>${s.coAttB ? pct(s.samePotCount / s.coAttB) : '—'}</td>
            <td>${z.toFixed(1)}</td>
            <td>${flag}</td>
        </tr>`;
    };

    const gapRows = Object.keys(gapBuckets)
        .sort((a, b) => (a === '5+' ? 1 : b === '5+' ? -1 : Number(a) - Number(b)))
        .map((bucket) => {
            const g = gapBuckets[bucket];
            const obs = g.paired / g.events;
            const exp = g.expected / g.events;
            const ratio = exp > 0 ? obs / exp : 0;
            const color = ratio < 0.5 ? '#fca5a5' : ratio > 1.5 ? '#6ee7b7' : '#e2e8f0';
            return `<tr>
                <td class="player-name">gap ${bucket}</td>
                <td>${g.events}</td>
                <td>${g.paired}</td>
                <td>${pct(obs)}</td>
                <td>${pct(exp)}</td>
                <td style="color:${color};font-weight:700">${ratio.toFixed(2)}×</td>
            </tr>`;
        })
        .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(LEAGUE_ID)} — ELO/Pot Pairing-Bias Report</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
h1 { font-size: 1.6rem; margin-bottom: 4px; color: #f8fafc; }
h2 { font-size: 1.1rem; margin: 28px 0 10px; color: #f1f5f9; }
.subtitle { color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px; }
.summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 20px; }
.stat-card .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-card .value { font-size: 1.5rem; font-weight: 700; color: #f8fafc; }
.legend { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 0.85rem; line-height: 1.7; }
.legend h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 10px; }
.table-wrap { overflow-x: auto; margin-bottom: 12px; }
table { border-collapse: collapse; font-size: 0.85rem; }
th { padding: 8px 12px; text-align: center; font-weight: 600; background: #1e293b; position: sticky; top: 0; }
td { padding: 6px 10px; text-align: center; border: 1px solid #1e293b; }
td.player-name { text-align: left; font-weight: 500; background: #1e293b; white-space: nowrap; color: #f1f5f9; border-right: 2px solid #334155; }
.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
.badge.ok { background: #064e3b; color: #6ee7b7; }
.badge.warn { background: #78350f; color: #fbbf24; }
.badge.bad { background: #7f1d1d; color: #fca5a5; }
.note { color: #64748b; font-size: 0.75rem; margin-top: 20px; line-height: 1.6; }
tr:hover td { filter: brightness(1.15); }
</style>
</head>
<body>
<h1>🎯 ${esc(LEAGUE_ID)} — ELO/Pot Pairing-Bias Report</h1>
<p class="subtitle">${sessions.length} sessions (${sessions[0].date} to ${sessions[sessions.length - 1].date}) · ${potSessions} seeded with pot data · generated ${new Date().toISOString().slice(0, 10)}</p>

<div class="summary">
    <div class="stat-card"><div class="label">Sessions</div><div class="value">${sessions.length}</div></div>
    <div class="stat-card"><div class="label">Seeded w/ pots</div><div class="value">${potSessions}</div></div>
    <div class="stat-card"><div class="label">Pairs ≥ ${MIN_CO_ATTENDANCE} co-attendances</div><div class="value">${suppressed.total}</div></div>
    <div class="stat-card"><div class="label">Never paired</div><div class="value" style="color:#fbbf24">${suppressed.neverPaired}</div></div>
    <div class="stat-card"><div class="label">Suppressed beyond pots</div><div class="value" style="color:#fca5a5">${suppressed.beyondPots}</div></div>
</div>

<div class="legend">
    <h3>Method</h3>
    <strong>Null A</strong> = fully random teams. <strong>Null B</strong> = random draw that respects that day's pots and per-team pot quotas.
    P(0)&nbsp;= probability the pair would have zero pairings by chance under each null.
    A never-paired pair with P(0)<sub>A</sub> &lt; 0.05 but plausible P(0)<sub>B</sub> is explained by <em>pot structure</em>;
    P(0)<sub>B</sub> &lt; 0.05 too means something <em>beyond</em> pots — the ELO-spread norm — is suppressing it.
    z = (actual − expected<sub>B</sub>) / σ<sub>B</sub>.
</div>

<h2>Rank-gap fingerprint (same-pot co-attendances, all pairs)</h2>
<div class="table-wrap">
<table>
<thead><tr><th>Within-pot ELO rank gap</th><th>Events</th><th>Paired</th><th>Observed rate</th><th>Expected rate (Null B)</th><th>Obs / Exp</th></tr></thead>
<tbody>
${gapRows}
</tbody>
</table>
</div>
<p class="note">If Obs/Exp is well below 1× at small gaps and above 1× at large gaps, the ELO-spread norm is pairing pot-mates complementarily (high+low) and starving ELO-adjacent pairs.</p>

<h2>Example pairs</h2>
<div class="table-wrap">
<table>
<thead><tr><th>Pair</th><th>Co-att.</th><th>Paired</th><th>Exp A</th><th>Exp B</th><th>P(0) A</th><th>P(0) B</th><th>Same-pot rate</th><th>z</th><th>Verdict</th></tr></thead>
<tbody>
${examples.map(pairRow).join('\n')}
</tbody>
</table>
</div>

<h2>Most-starved pairs (≥ ${MIN_CO_ATTENDANCE} co-attendances, sorted by pairing debt exp B − actual)</h2>
<div class="table-wrap">
<table>
<thead><tr><th>Pair</th><th>Co-att.</th><th>Paired</th><th>Exp A</th><th>Exp B</th><th>P(0) A</th><th>P(0) B</th><th>Same-pot rate</th><th>z</th><th>Verdict</th></tr></thead>
<tbody>
${suppressed.top.map(pairRow).join('\n')}
</tbody>
</table>
</div>

<p class="note">
Pot data from drawHistory.initialPots (seeded draws only); sessions without it contribute to Null A columns only.
Same-pot rate = share of pot-tracked co-attendances where the pair sat in the same pot.
Expected rates use the actual per-team pot quotas of each day, so ragged pots and uneven team sizes are handled exactly.
</p>
</body>
</html>`;
}

async function main() {
    try {
        const sessions = await loadSessions();
        const potSessions = sessions.filter((s) => s.pots).length;
        const { pairs, gapBuckets } = analyze(sessions);

        const eligible = [...pairs.values()].filter((s) => s.coAtt >= MIN_CO_ATTENDANCE);
        const neverPaired = eligible.filter((s) => s.paired === 0);
        const beyondPots = neverPaired.filter((s) => s.probNoneB < 0.05);
        const top = [...eligible]
            .sort((a, b) => b.expB - b.pairedB - (a.expB - a.pairedB))
            .slice(0, 25);

        console.log(`=== ${LEAGUE_ID.toUpperCase()} PAIRING BIAS ANALYSIS ===`);
        console.log(
            `${sessions.length} sessions (${sessions[0].date} → ${sessions[sessions.length - 1].date}), ${potSessions} with pot data`
        );
        console.log(
            `Pairs with >= ${MIN_CO_ATTENDANCE} co-attendances: ${eligible.length}, never paired: ${neverPaired.length}, suppressed beyond pot structure: ${beyondPots.length}`
        );

        console.log('\n=== RANK-GAP FINGERPRINT (same-pot events) ===');
        Object.keys(gapBuckets)
            .sort((a, b) => (a === '5+' ? 1 : b === '5+' ? -1 : Number(a) - Number(b)))
            .forEach((bucket) => {
                const g = gapBuckets[bucket];
                const obs = g.paired / g.events;
                const exp = g.expected / g.events;
                console.log(
                    `gap ${bucket}: ${g.events} events, paired ${g.paired} ` +
                        `(obs ${(obs * 100).toFixed(1)}% vs exp ${(exp * 100).toFixed(1)}%, ratio ${(exp > 0 ? obs / exp : 0).toFixed(2)}x)`
                );
            });

        console.log('\n=== EXAMPLE PAIRS ===');
        const examples = EXAMPLE_PAIRS.map(([a, b]) => pairs.get(pairKey(a, b))).filter(Boolean);
        for (const s of examples) {
            const z = s.varB > 0 ? (s.pairedB - s.expB) / Math.sqrt(s.varB) : 0;
            console.log(
                `${s.p1} & ${s.p2}: coAtt ${s.coAtt}, paired ${s.paired}, ` +
                    `expA ${s.expA.toFixed(1)}, expB ${s.expB.toFixed(1)}, ` +
                    `P(0)A ${s.probNoneA.toFixed(3)}, P(0)B ${s.probNoneB.toFixed(3)}, ` +
                    `same-pot ${s.coAttB ? ((s.samePotCount / s.coAttB) * 100).toFixed(0) : '—'}%, z ${z.toFixed(1)}`
            );
        }

        console.log('\n=== TOP STARVED PAIRS (by pairing debt expB - actual) ===');
        for (const s of top.slice(0, 15)) {
            console.log(
                `${s.p1} & ${s.p2}: coAtt ${s.coAtt}, paired ${s.paired}, expB ${s.expB.toFixed(1)}, ` +
                    `P(0)B ${s.probNoneB.toFixed(3)}, same-pot ${s.coAttB ? ((s.samePotCount / s.coAttB) * 100).toFixed(0) : '—'}%`
            );
        }

        const html = renderHtml(
            sessions,
            {
                total: eligible.length,
                neverPaired: neverPaired.length,
                beyondPots: beyondPots.length,
                top
            },
            examples,
            gapBuckets,
            potSessions
        );
        const reportPath = 'pairing-bias-report.html';
        await writeFile(reportPath, html);
        console.log(`\n📄 HTML report saved to: ${reportPath}`);
    } catch (error) {
        console.error('Error analyzing pairing bias:', error);
        process.exit(1);
    }
}

main();
