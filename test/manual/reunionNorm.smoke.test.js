import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { createTeammateHistoryTracker } from '$lib/server/teammateHistory.js';
import { createTeamGenerator } from '$lib/server/teamGenerator.js';
import { createRankingsManager } from '$lib/server/rankings.js';

/**
 * Smoke test for the reunion norm against real league data.
 * Replays a seeded draw with the latest session's players, with and without
 * overdue pairs, and reports reunion satisfaction rate and ELO delta cost.
 *
 * Run explicitly with: SMOKE=1 npx vitest run --config vitest.config.js test/manual/reunionNorm.smoke.test.js
 */

/* eslint-disable no-console */

const LEAGUE = process.env.SMOKE_LEAGUE || 'pirates';
const SESSION = process.env.SMOKE_SESSION || '2026-06-27';
const RUNS = Number(process.env.SMOKE_RUNS) || 10;

const enabled = process.env.SMOKE === '1' && existsSync(`data/${LEAGUE}/${SESSION}.json`);

describe.runIf(enabled)('Reunion norm smoke test (real data)', () => {
    it(
        'reports overdue pairs and reunion satisfaction over repeated draws',
        { timeout: 600000 },
        async () => {
            const tracker = createTeammateHistoryTracker();
            // Mirror teamGenerationContext.js parameters
            const overduePairs = await tracker.findOverduePairs(LEAGUE, {
                sessionLimit: 40,
                coAttendanceLimit: 15,
                alpha: 0.05,
                beforeDate: SESSION
            });

            console.log(
                `\nOverdue pairs (15 co-attendances / 40-session lookback, alpha 0.05): ${overduePairs.length}`
            );
            overduePairs.forEach((p) =>
                console.log(
                    `  ${p.player1} & ${p.player2}: coAtt ${p.coAttendance}, P(0)=${p.probNone.toFixed(3)}`
                )
            );

            const session = JSON.parse(readFileSync(`data/${LEAGUE}/${SESSION}.json`, 'utf8'));
            const players = Object.values(session.teams).flat().filter(Boolean);
            const numTeams = Object.keys(session.teams).length;
            const teamSizes = Object.values(session.teams).map((t) => t.length);
            console.log(`\nReplaying ${SESSION}: ${players.length} players, ${numTeams} teams`);

            const rankings = await createRankingsManager()
                .setLeague(LEAGUE)
                .loadEnhancedRankings(new Date(SESSION).getFullYear(), {
                    fallbackToPreviousYear: true
                });
            // Read-only history build (updateTeammateHistory would write to the league dir)
            const history = await tracker.buildTeammateHistory(LEAGUE, 10);

            const settings = {
                teamGeneration: {
                    minTeams: 2,
                    maxTeams: 6,
                    minPlayersPerTeam: 4,
                    maxPlayersPerTeam: 7
                }
            };
            const config = { teams: numTeams, teamSizes };

            const attending = new Set(players);
            const candidates = overduePairs.filter(
                (p) => attending.has(p.player1) && attending.has(p.player2)
            );
            console.log(
                `Attending overdue pairs: ${candidates.map((p) => `${p.player1}&${p.player2}`).join(', ') || 'none'}`
            );

            /** @param {boolean} withReunion */
            const runDraws = async (withReunion) => {
                const results = [];
                for (let i = 0; i < RUNS; i++) {
                    const generator = createTeamGenerator()
                        .setLeague(`smoke-reunion-test`)
                        .setSettings(settings)
                        .setPlayers(players)
                        .setRankings(rankings)
                        .setTeammateHistory(history)
                        .setOverduePairs(withReunion ? overduePairs : []);
                    const result = await generator.generateTeams('seeded', config);
                    const teams = result.teams ?? result;

                    const teamOf = new Map();
                    Object.entries(teams).forEach(([name, list]) =>
                        list.forEach((p) => teamOf.set(p, name))
                    );
                    const satisfied = candidates.some(
                        (p) => teamOf.get(p.player1) === teamOf.get(p.player2)
                    );
                    const satisfiedPairs = candidates.filter(
                        (p) => teamOf.get(p.player1) === teamOf.get(p.player2)
                    );
                    const eloDelta = generator.calculateEloDelta(
                        generator.calculateTeamEloAverages(teams)
                    );
                    results.push({ satisfied, satisfiedPairs, eloDelta });
                }
                return results;
            };

            const withReunion = await runDraws(true);
            const baseline = await runDraws(false);

            const summarize = (label, results) => {
                const satisfied = results.filter((r) => r.satisfied).length;
                const avgElo = results.reduce((s, r) => s + r.eloDelta, 0) / results.length;
                const maxElo = Math.max(...results.map((r) => r.eloDelta));
                console.log(
                    `\n${label}: reunion satisfied ${satisfied}/${results.length}, ` +
                        `avg eloDelta ${avgElo.toFixed(1)}, max ${maxElo.toFixed(1)}`
                );
                const pairCounts = {};
                results.forEach((r) =>
                    r.satisfiedPairs.forEach((p) => {
                        const key = `${p.player1}&${p.player2}`;
                        pairCounts[key] = (pairCounts[key] || 0) + 1;
                    })
                );
                if (Object.keys(pairCounts).length) {
                    console.log(
                        `  reunited: ${Object.entries(pairCounts)
                            .map(([k, v]) => `${k}×${v}`)
                            .join(', ')}`
                    );
                }
            };

            summarize('WITH reunion norm', withReunion);
            summarize('BASELINE (no norm)', baseline);

            expect(withReunion.length).toBe(RUNS);
        }
    );
});

describe.runIf(!enabled)('Reunion norm smoke test (skipped)', () => {
    it('is skipped without SMOKE=1 and real league data', () => {
        expect(true).toBe(true);
    });
});
