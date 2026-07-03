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
    });
});
