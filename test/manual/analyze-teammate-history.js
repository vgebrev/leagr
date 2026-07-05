#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Analyze teammate pairing history and hard-constraint pressure for a league.
 *
 * For each recent session, rebuilds the 10-session history window as it stood
 * BEFORE that draw (matching what the team generator saw) and reports:
 *   - how many attendee pairs were blocked (>= 4 prior pairings, the hard constraint)
 *   - how many were at the limit (exactly 3 prior pairings)
 *   - whether the drawn teams actually contained blocked pairs (fallback draw)
 *
 * Also emits an HTML report (heatmap matrix + per-session table).
 *
 * Usage: node test/manual/analyze-teammate-history.js [leagueId] [sessionsToAnalyze]
 */

import { createTeammateHistoryTracker } from '../../src/lib/server/teammateHistory.js';
import { writeFile } from 'fs/promises';

// Must match teamGenerator.js: hardConstraintLimit = 4, sessionLimit = 10
const HARD_CONSTRAINT_LIMIT = 4;
const SESSION_WINDOW = 10;

const LEAGUE_ID = process.argv[2] || 'pirates';
const SESSIONS_TO_ANALYZE = Number(process.argv[3]) || 15;

/**
 * Look up prior pairing count for two players in a history matrix
 * @param {Object} history - Teammate history data
 * @param {string} p1 - First player
 * @param {string} p2 - Second player
 * @returns {number} Prior pairing count
 */
function priorCount(history, p1, p2) {
    const i = history.players.indexOf(p1);
    const j = history.players.indexOf(p2);
    return i >= 0 && j >= 0 ? history.matrix[i][j] : 0;
}

/**
 * Extract all unique pairs from a list of players
 * @param {string[]} players - Player names
 * @returns {Array<[string, string]>} Unique pairs
 */
function allPairs(players) {
    const pairs = [];
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            pairs.push([players[i], players[j]]);
        }
    }
    return pairs;
}

/**
 * Analyze constraint pressure for each recent session
 * @param {import('../../src/lib/server/teammateHistory.js').TeammateHistoryTracker} tracker
 * @returns {Promise<Array<Object>>} Per-session analysis, oldest first
 */
async function analyzeSessions(tracker) {
    const files = await tracker.getSessionFiles(LEAGUE_ID, null);
    const sessions = [];

    for (const filePath of files) {
        const data = await tracker.loadSessionData(filePath);
        if (!data?.teams || Object.keys(data.teams).length === 0) continue;
        const date = filePath.match(/(\d{4}-\d{2}-\d{2})\.json$/)[1];
        sessions.push({ date, teams: data.teams });
        if (sessions.length >= SESSIONS_TO_ANALYZE) break;
    }
    sessions.reverse(); // oldest first

    const results = [];
    for (const { date, teams } of sessions) {
        const history = await tracker.buildTeammateHistory(LEAGUE_ID, SESSION_WINDOW, date);
        const attendees = Object.values(teams)
            .flat()
            .filter((p) => p && typeof p === 'string' && p.trim().length > 0);

        const candidatePairs = allPairs(attendees);
        const blockedPairs = [];
        const atLimitPairs = [];
        for (const [p1, p2] of candidatePairs) {
            const count = priorCount(history, p1, p2);
            if (count >= HARD_CONSTRAINT_LIMIT) blockedPairs.push({ p1, p2, count });
            else if (count === HARD_CONSTRAINT_LIMIT - 1) atLimitPairs.push({ p1, p2, count });
        }

        // Pairs actually drawn into the same team, by prior count
        const drawnViolations = [];
        const drawnAtLimit = [];
        for (const team of Object.values(teams)) {
            const valid = team.filter((p) => p && typeof p === 'string' && p.trim().length > 0);
            for (const [p1, p2] of allPairs(valid)) {
                const count = priorCount(history, p1, p2);
                if (count >= HARD_CONSTRAINT_LIMIT) drawnViolations.push({ p1, p2, count });
                else if (count === HARD_CONSTRAINT_LIMIT - 1) drawnAtLimit.push({ p1, p2, count });
            }
        }

        results.push({
            date,
            attendees: attendees.length,
            teamCount: Object.keys(teams).length,
            historySessions: history.totalSessions,
            possiblePairs: candidatePairs.length,
            blockedPairs,
            atLimitPairs,
            drawnViolations,
            drawnAtLimit
        });
    }
    return results;
}

/**
 * Compute pairing frequency distribution for a history window
 * @param {Object} history - Teammate history data
 * @returns {{distribution: Object, pairings: Array, totalPairs: number}}
 */
function summarizeHistory(history) {
    const pairings = [];
    for (let i = 0; i < history.players.length; i++) {
        for (let j = i + 1; j < history.players.length; j++) {
            if (history.matrix[i][j] > 0) {
                pairings.push({
                    p1: history.players[i],
                    p2: history.players[j],
                    count: history.matrix[i][j]
                });
            }
        }
    }
    pairings.sort((a, b) => b.count - a.count || `${a.p1}${a.p2}`.localeCompare(`${b.p1}${b.p2}`));

    const distribution = {};
    pairings.forEach(({ count }) => {
        distribution[count] = (distribution[count] || 0) + 1;
    });
    return { distribution, pairings };
}

/**
 * Render the HTML report
 * @param {Object} history - Current teammate history window
 * @param {Array} sessionResults - Per-session constraint analysis
 * @returns {string} HTML document
 */
function renderHtml(history, sessionResults) {
    const { distribution, pairings } = summarizeHistory(history);
    const hotPairs = pairings.filter((p) => p.count >= HARD_CONSTRAINT_LIMIT - 1);
    const blockedNow = pairings.filter((p) => p.count >= HARD_CONSTRAINT_LIMIT);
    const sessionsWithViolations = sessionResults.filter((s) => s.drawnViolations.length > 0);

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cellStyle = (count) => {
        if (count >= 4) return 'background:#dc2626;color:#fff;font-weight:700';
        if (count === 3) return 'background:#f59e0b;color:#111;font-weight:700';
        if (count === 2) return 'background:#3b82f6;color:#fff';
        if (count === 1) return 'background:#334155;color:#cbd5e1';
        return 'background:#0f172a;color:#1e293b';
    };

    // Sort players by total pairings (descending) for the matrix
    const totals = history.players.map((p, i) => ({
        player: p,
        index: i,
        total: history.matrix[i].reduce((sum, c) => sum + c, 0)
    }));
    totals.sort((a, b) => b.total - a.total);

    const matrixHeader = totals
        .map((t) => `<th class="rot"><div><span>${esc(t.player)}</span></div></th>`)
        .join('');
    const matrixRows = totals
        .map((row) => {
            const cells = totals
                .map((col) => {
                    if (row.index === col.index) {
                        return '<td style="background:#1e293b">·</td>';
                    }
                    const count = history.matrix[row.index][col.index];
                    return `<td style="${cellStyle(count)}" title="${esc(row.player)} &amp; ${esc(col.player)}: ${count}">${count || ''}</td>`;
                })
                .join('');
            return `<tr><td class="player-name">${esc(row.player)}</td><td class="total">${row.total}</td>${cells}</tr>`;
        })
        .join('\n');

    const distRows = Object.keys(distribution)
        .map(Number)
        .sort((a, b) => b - a)
        .map((count) => {
            const n = distribution[count];
            const pct = ((n / pairings.length) * 100).toFixed(1);
            return `<tr><td>${count}×</td><td>${n}</td><td>${pct}%</td><td><div class="bar" style="width:${Math.min(100, pct * 2)}%"></div></td></tr>`;
        })
        .join('\n');

    const fmtPairs = (list) =>
        list.length === 0
            ? '<span class="ok">—</span>'
            : list.map((p) => `${esc(p.p1)} &amp; ${esc(p.p2)} (${p.count})`).join(', ');

    const sessionRows = sessionResults
        .map((s) => {
            const blockedPct = ((s.blockedPairs.length / s.possiblePairs) * 100).toFixed(1);
            const status =
                s.drawnViolations.length > 0
                    ? '<span class="badge bad">violated</span>'
                    : s.blockedPairs.length > 0
                      ? '<span class="badge warn">constrained</span>'
                      : '<span class="badge ok">free</span>';
            return `<tr>
                <td class="player-name">${s.date}</td>
                <td>${s.attendees} / ${s.teamCount}</td>
                <td>${s.historySessions}</td>
                <td>${s.blockedPairs.length} <span class="dim">(${blockedPct}%)</span></td>
                <td>${s.atLimitPairs.length}</td>
                <td>${s.drawnAtLimit.length}</td>
                <td class="wrap">${fmtPairs(s.drawnViolations)}</td>
                <td>${status}</td>
            </tr>`;
        })
        .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(LEAGUE_ID)} — Teammate Pairing &amp; Hard-Constraint Report</title>
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
.legend { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
.legend h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 10px; }
.legend-items { display: flex; flex-wrap: wrap; gap: 12px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; }
.legend-box { width: 14px; height: 14px; border-radius: 3px; }
.table-wrap { overflow-x: auto; margin-bottom: 12px; }
table { border-collapse: collapse; font-size: 0.85rem; }
th { padding: 8px 12px; text-align: center; font-weight: 600; background: #1e293b; position: sticky; top: 0; z-index: 2; }
td { padding: 6px 10px; text-align: center; border: 1px solid #1e293b; }
td.player-name { text-align: left; font-weight: 500; background: #1e293b; white-space: nowrap; color: #f1f5f9; border-right: 2px solid #334155; position: sticky; left: 0; z-index: 1; }
td.total { background: #1e293b; color: #94a3b8; font-weight: 600; }
td.wrap { text-align: left; max-width: 420px; }
.dim { color: #64748b; }
.ok { color: #6ee7b7; }
.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
.badge.ok { background: #064e3b; color: #6ee7b7; }
.badge.warn { background: #78350f; color: #fbbf24; }
.badge.bad { background: #7f1d1d; color: #fca5a5; }
.bar { height: 10px; background: #3b82f6; border-radius: 2px; min-width: 2px; }
th.rot { height: 130px; white-space: nowrap; padding: 0; vertical-align: bottom; }
th.rot > div { transform: translate(6px, -5px) rotate(315deg); width: 24px; }
th.rot > div > span { padding: 2px; font-size: 0.7rem; }
.matrix td { min-width: 26px; height: 26px; padding: 2px; font-size: 0.75rem; }
.note { color: #64748b; font-size: 0.75rem; margin-top: 20px; line-height: 1.6; }
tr:hover td { filter: brightness(1.15); }
</style>
</head>
<body>
<h1>🤝 ${esc(LEAGUE_ID)} — Teammate Pairing &amp; Hard-Constraint Report</h1>
<p class="subtitle">Window: last ${SESSION_WINDOW} sessions · hard constraint blocks pairs with ${HARD_CONSTRAINT_LIMIT}+ prior pairings · generated ${new Date().toISOString().slice(0, 10)}</p>

<div class="summary">
    <div class="stat-card"><div class="label">Sessions analyzed</div><div class="value">${sessionResults.length}</div></div>
    <div class="stat-card"><div class="label">Players in window</div><div class="value">${history.metadata.totalPlayers}</div></div>
    <div class="stat-card"><div class="label">Max pairings (window)</div><div class="value">${history.metadata.maxPairings}</div></div>
    <div class="stat-card"><div class="label">Pairs blocked next draw</div><div class="value" style="color:${blockedNow.length ? '#fca5a5' : '#6ee7b7'}">${blockedNow.length}</div></div>
    <div class="stat-card"><div class="label">Pairs at limit (3×)</div><div class="value" style="color:#fbbf24">${hotPairs.length - blockedNow.length}</div></div>
    <div class="stat-card"><div class="label">Sessions w/ violated draws</div><div class="value" style="color:${sessionsWithViolations.length ? '#fca5a5' : '#6ee7b7'}">${sessionsWithViolations.length}</div></div>
</div>

<div class="legend">
    <h3>How to read this report</h3>
    <div class="legend-items">
        <div class="legend-item"><div class="legend-box" style="background:#dc2626"></div>4+ pairings — blocked by hard constraint</div>
        <div class="legend-item"><div class="legend-box" style="background:#f59e0b"></div>3 pairings — at limit (one more allowed)</div>
        <div class="legend-item"><div class="legend-box" style="background:#3b82f6"></div>2 pairings</div>
        <div class="legend-item"><div class="legend-box" style="background:#334155"></div>1 pairing</div>
        <div class="legend-item">"violated" = drawn teams contained a blocked pair (generator fell back or draw was manual/random)</div>
    </div>
</div>

<h2>Per-session constraint pressure (as seen by the generator before each draw)</h2>
<div class="table-wrap">
<table>
<thead><tr>
    <th>Session</th><th>Players / Teams</th><th>History depth</th>
    <th>Blocked pairs available</th><th>At-limit pairs available</th>
    <th>At-limit pairs drawn</th><th>Blocked pairs drawn (violations)</th><th>Status</th>
</tr></thead>
<tbody>
${sessionRows}
</tbody>
</table>
</div>

<h2>Current window — pairing frequency distribution</h2>
<div class="table-wrap">
<table>
<thead><tr><th>Pairings</th><th>Pairs</th><th>%</th><th></th></tr></thead>
<tbody>
${distRows}
</tbody>
</table>
</div>

<h2>Current window — pairing matrix (sorted by total pairings)</h2>
<div class="table-wrap">
<table class="matrix">
<thead><tr><th style="text-align:left">Player</th><th>Total</th>${matrixHeader}</tr></thead>
<tbody>
${matrixRows}
</tbody>
</table>
</div>

<p class="note">
History window and limits mirror teamGenerator.js (hardConstraintLimit=${HARD_CONSTRAINT_LIMIT}, sessionLimit=${SESSION_WINDOW}).
Per-session analysis rebuilds the window with beforeDate=session date, exactly as the generator does, so
"blocked pairs available" is the number of attendee pairs the generator was forbidden from putting on the same team that day.
</p>
</body>
</html>`;
}

async function main() {
    try {
        const tracker = createTeammateHistoryTracker();

        // Current window (what the NEXT draw will see) — read-only, does not touch teammate-history.json
        const history = await tracker.buildTeammateHistory(LEAGUE_ID, SESSION_WINDOW);
        const { distribution, pairings } = summarizeHistory(history);

        console.log('=== CURRENT WINDOW ===');
        console.log(`League: ${history.leagueId}`);
        console.log(`Sessions in window: ${history.totalSessions}`);
        console.log(`Players: ${history.metadata.totalPlayers}`);
        console.log(`Unique pairs: ${history.metadata.totalUniquePairs}`);
        console.log(`Max pairings: ${history.metadata.maxPairings}`);

        console.log('\n=== PAIRING FREQUENCY DISTRIBUTION ===');
        Object.keys(distribution)
            .map(Number)
            .sort((a, b) => b - a)
            .forEach((count) => {
                const n = distribution[count];
                console.log(
                    `${count} pairings: ${n} pairs (${((n / pairings.length) * 100).toFixed(1)}%)`
                );
            });

        const hot = pairings.filter((p) => p.count >= HARD_CONSTRAINT_LIMIT - 1);
        console.log(`\n=== PAIRS AT/OVER LIMIT (${HARD_CONSTRAINT_LIMIT - 1}+) ===`);
        hot.forEach((p) =>
            console.log(
                `${p.p1} & ${p.p2}: ${p.count}${p.count >= HARD_CONSTRAINT_LIMIT ? '  ← BLOCKED next draw' : ''}`
            )
        );

        console.log('\n=== PER-SESSION CONSTRAINT PRESSURE ===');
        const sessionResults = await analyzeSessions(tracker);
        sessionResults.forEach((s) => {
            const pct = ((s.blockedPairs.length / s.possiblePairs) * 100).toFixed(1);
            const violations = s.drawnViolations.length
                ? ` VIOLATIONS: ${s.drawnViolations.map((v) => `${v.p1}&${v.p2}(${v.count})`).join(', ')}`
                : '';
            console.log(
                `${s.date}: ${s.attendees} players, ${s.blockedPairs.length}/${s.possiblePairs} pairs blocked (${pct}%), ` +
                    `${s.atLimitPairs.length} at limit, drawn at-limit: ${s.drawnAtLimit.length}${violations}`
            );
        });

        const reportPath = `teammate-pairing-report.html`;
        await writeFile(reportPath, renderHtml(history, sessionResults));
        console.log(`\n📄 HTML report saved to: ${reportPath}`);
    } catch (error) {
        console.error('Error analyzing teammate history:', error);
        process.exit(1);
    }
}

main();
