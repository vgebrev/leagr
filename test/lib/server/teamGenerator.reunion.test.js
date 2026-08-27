import { describe, it, expect, beforeEach } from 'vitest';
import { createTeamGenerator } from '$lib/server/teamGenerator.js';

describe('TeamGenerator reunion norm (overdue pairs)', () => {
    let tg;

    const teams = {
        'Team A': ['Alice', 'Bob', 'Charlie'],
        'Team B': ['Diana', 'Eve', 'Frank']
    };

    beforeEach(() => {
        tg = createTeamGenerator().setLeague('test-reunion');
    });

    describe('setOverduePairs', () => {
        it('is fluent and defaults to an empty list', () => {
            expect(tg.setOverduePairs([{ player1: 'A', player2: 'B' }])).toBe(tg);
            expect(tg.setOverduePairs(null).overduePairs).toEqual([]);
        });
    });

    describe('calculateReunionScoreNormalized', () => {
        it('returns 0 (neutral) when no overdue pairs are set', () => {
            expect(tg.calculateReunionScoreNormalized(teams)).toBe(0);
        });

        it('returns 0 (neutral) when overdue pairs are not in the draw', () => {
            tg.setOverduePairs([{ player1: 'Zack', player2: 'Yuri' }]);
            expect(tg.calculateReunionScoreNormalized(teams)).toBe(0);
        });

        it('returns 1 when an attending overdue pair is split across teams', () => {
            tg.setOverduePairs([{ player1: 'Alice', player2: 'Diana' }]);
            expect(tg.calculateReunionScoreNormalized(teams)).toBe(1);
        });

        it('returns 0 when an attending overdue pair shares a team', () => {
            tg.setOverduePairs([{ player1: 'Alice', player2: 'Bob' }]);
            expect(tg.calculateReunionScoreNormalized(teams)).toBe(0);
        });

        it('gives fractional credit per reunited pair (equal weights without probNone)', () => {
            tg.setOverduePairs([
                { player1: 'Alice', player2: 'Diana' }, // split
                { player1: 'Eve', player2: 'Frank' } // together
            ]);
            expect(tg.calculateReunionScoreNormalized(teams)).toBeCloseTo(0.5);
        });

        it('returns 0 only when every attending overdue pair is reunited', () => {
            tg.setOverduePairs([
                { player1: 'Alice', player2: 'Bob' }, // together
                { player1: 'Eve', player2: 'Frank' } // together
            ]);
            expect(tg.calculateReunionScoreNormalized(teams)).toBe(0);
        });

        it('weights credit by starvation so reuniting the most starved pair scores lower', () => {
            const starvedTogether = tg
                .setOverduePairs([
                    { player1: 'Alice', player2: 'Bob', probNone: 0.01 }, // starved, together
                    { player1: 'Eve', player2: 'Diana', probNone: 0.04 } // less starved, split
                ])
                .calculateReunionScoreNormalized(teams);
            const mildTogether = tg
                .setOverduePairs([
                    { player1: 'Alice', player2: 'Diana', probNone: 0.01 }, // starved, split
                    { player1: 'Eve', player2: 'Frank', probNone: 0.04 } // less starved, together
                ])
                .calculateReunionScoreNormalized(teams);
            expect(starvedTogether).toBeLessThan(mildTogether);
        });

        it('treats a pair with only one player attending as absent', () => {
            tg.setOverduePairs([{ player1: 'Alice', player2: 'Zack' }]);
            expect(tg.calculateReunionScoreNormalized(teams)).toBe(0);
        });

        it('prefers one severely starved reunion over two mild ones', () => {
            // Live pirates values: Dan & Veli sit 25 co-attendances into a drought while
            // Brent & Veli and Irry & Tinashe sit at 12. The alpha-capped probNone cannot
            // tell them apart (0.025 vs 0.043/0.048), so weighting on it alone prefers the
            // two cheap reunions. Weighting on the uncapped drought must invert that.
            const severe = {
                player1: 'S1',
                player2: 'S2',
                probNone: 0.02538,
                droughtProbNone: 0.00219
            };
            const mildA = {
                player1: 'M1',
                player2: 'M2',
                probNone: 0.0428,
                droughtProbNone: 0.0428
            };
            const mildB = {
                player1: 'M3',
                player2: 'M4',
                probNone: 0.04751,
                droughtProbNone: 0.04751
            };

            const severeReunited = { A: ['S1', 'S2', 'M1', 'M3'], B: ['M2', 'M4'] };
            const mildReunited = { A: ['S1', 'M1', 'M2'], B: ['S2', 'M3', 'M4'] };

            const score = (layout) =>
                tg.setOverduePairs([severe, mildA, mildB]).calculateReunionScoreNormalized(layout);

            expect(score(severeReunited)).toBeLessThan(score(mildReunited));
        });

        it('falls back to probNone when a pair carries no drought evidence', () => {
            const withDrought = tg
                .setOverduePairs([
                    { player1: 'Alice', player2: 'Bob', probNone: 0.9, droughtProbNone: 0.01 },
                    { player1: 'Eve', player2: 'Diana', probNone: 0.9, droughtProbNone: 0.04 }
                ])
                .calculateReunionScoreNormalized(teams);
            const withoutDrought = tg
                .setOverduePairs([
                    { player1: 'Alice', player2: 'Bob', probNone: 0.01 },
                    { player1: 'Eve', player2: 'Diana', probNone: 0.04 }
                ])
                .calculateReunionScoreNormalized(teams);
            expect(withoutDrought).toBe(withDrought);
        });
    });

    describe('calculateNormalizedScore integration', () => {
        it('includes reunionNorm in the metrics', () => {
            const metrics = tg.calculateNormalizedScore(teams, 200, 60);
            expect(metrics).toHaveProperty('reunionNorm');
            expect(metrics.reunionNorm).toBe(0);
        });

        it('does not change totalNorm when no overdue pairs are set', () => {
            const baseline = tg.calculateNormalizedScore(teams, 200, 60);
            const withEmpty = tg.setOverduePairs([]).calculateNormalizedScore(teams, 200, 60);
            expect(withEmpty.totalNorm).toBe(baseline.totalNorm);
        });

        it('scores an unsatisfied reunion worse than a satisfied one for the same teams', () => {
            const satisfied = tg
                .setOverduePairs([{ player1: 'Alice', player2: 'Bob' }])
                .calculateNormalizedScore(teams, 200, 60);
            const unsatisfied = tg
                .setOverduePairs([{ player1: 'Alice', player2: 'Diana' }])
                .calculateNormalizedScore(teams, 200, 60);
            expect(unsatisfied.reunionNorm).toBe(1);
            expect(satisfied.reunionNorm).toBe(0);
            expect(unsatisfied.totalNorm).toBeGreaterThan(satisfied.totalNorm);
        });

        it('prefers a reunited draw over a better-balanced split draw', () => {
            // The reunion the norm exists to buy always costs ELO balance: chronically
            // starved pairs are starved precisely because pairing them is expensive.
            // Alice+Bob together costs ~0.5 of eloNorm here, which outvoted the reunion
            // at the original W_REUNION of 0.4 — the bug that kept such pairs apart.
            const rankings = {
                players: Object.fromEntries(
                    [
                        ['Alice', 1400],
                        ['Bob', 1300],
                        ['Charlie', 1000],
                        ['Diana', 1000],
                        ['Eve', 1000],
                        ['Frank', 1000]
                    ].map(([name, rating]) => [name, { elo: { rating, gamesPlayed: 50 } }])
                )
            };
            const overdue = [{ player1: 'Alice', player2: 'Bob', probNone: 0.02 }];
            const reunited = {
                'Team A': ['Alice', 'Bob', 'Charlie'],
                'Team B': ['Diana', 'Eve', 'Frank']
            };
            const split = {
                'Team A': ['Alice', 'Charlie', 'Diana'],
                'Team B': ['Bob', 'Eve', 'Frank']
            };

            const score = (layout) =>
                createTeamGenerator()
                    .setLeague('test-reunion')
                    .setRankings(rankings)
                    .setOverduePairs(overdue)
                    .calculateNormalizedScore(layout, 400, 400);

            const withReunion = score(reunited);
            const withoutReunion = score(split);

            expect(withReunion.reunionNorm).toBe(0);
            expect(withoutReunion.reunionNorm).toBe(1);
            // The split draw really is the better-balanced one...
            expect(withoutReunion.eloNorm).toBeLessThan(withReunion.eloNorm);
            // ...and the reunion still wins overall.
            expect(withReunion.totalNorm).toBeLessThan(withoutReunion.totalNorm);
        });
    });

    describe('logged metrics describe the returned teams', () => {
        it('re-scores after swap optimization so the reunion score is not stale', async () => {
            const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
            const generator = createTeamGenerator()
                .setLeague('test-reunion')
                .setSettings({
                    teamGeneration: {
                        minTeams: 2,
                        maxTeams: 6,
                        minPlayersPerTeam: 4,
                        maxPlayersPerTeam: 7
                    }
                })
                .setPlayers(names)
                .setRankings({
                    players: Object.fromEntries(
                        names.map((name, i) => [
                            name,
                            { elo: { rating: 1200 - i * 25, gamesPlayed: 50 } }
                        ])
                    )
                })
                // A history object is required for the swap optimizer to run at all
                .setTeammateHistory({
                    players: names,
                    matrix: names.map(() => names.map(() => 0))
                })
                .setOverduePairs([{ player1: 'Alice', player2: 'Henry', probNone: 0.02 }]);

            // Force the optimizer to return a layout the snake draft can never produce
            // (all four top seeds on one team), so the pre-swap metrics are guaranteed
            // to differ from the metrics of the teams actually returned.
            const optimized = {
                'Team A': ['Alice', 'Bob', 'Charlie', 'Diana'],
                'Team B': ['Eve', 'Frank', 'Grace', 'Henry']
            };
            generator.optimizeTeamsWithSwaps = () => structuredClone(optimized);

            let logged = null;
            generator.logDrawInfo = (args) => {
                logged = args;
            };

            const { teams } = await generator.generateTeams('seeded', { teamSizes: [4, 4] });

            expect(Object.values(teams)).toEqual(Object.values(optimized));
            expect(logged?.bestMetrics).toBeTruthy();
            expect(logged.bestMetrics.eloDelta).toBe(
                generator.calculateEloDelta(generator.calculateTeamEloAverages(teams))
            );
            expect(logged.bestMetrics.reunionNorm).toBe(
                generator.calculateReunionScoreNormalized(teams)
            );
        });
    });
});
