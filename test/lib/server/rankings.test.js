import { describe, it, expect, beforeEach } from 'vitest';
import { createRankingsManager } from '$lib/server/rankings.js';

describe('RankingsManager - Knockout Points', () => {
    let rankingsManager;

    beforeEach(() => {
        rankingsManager = createRankingsManager();
    });

    describe('getKnockoutPoints', () => {
        it('should calculate knockout points for winning players', () => {
            const teams = {
                'Red Team': ['Alice', 'Bob'],
                'Blue Team': ['Charlie', 'David'],
                'Green Team': ['Eve', 'Frank'],
                'Yellow Team': ['Grace', 'Henry']
            };

            const knockoutBracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Red Team',
                    away: 'Blue Team',
                    homeScore: 2,
                    awayScore: 1
                },
                {
                    round: 'semi',
                    match: 2,
                    home: 'Green Team',
                    away: 'Yellow Team',
                    homeScore: 1,
                    awayScore: 3
                },
                {
                    round: 'final',
                    match: 1,
                    home: 'Red Team',
                    away: 'Yellow Team',
                    homeScore: 2,
                    awayScore: 0
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // Red Team won 2 matches (semi + final)
            expect(result['Alice']).toBe(2);
            expect(result['Bob']).toBe(2);

            // Yellow Team won 1 match (semi)
            expect(result['Grace']).toBe(1);
            expect(result['Henry']).toBe(1);

            // Blue Team and Green Team didn't win any matches
            expect(result['Charlie']).toBeUndefined();
            expect(result['David']).toBeUndefined();
            expect(result['Eve']).toBeUndefined();
            expect(result['Frank']).toBeUndefined();
        });

        it('should handle incomplete matches', () => {
            const teams = {
                'Red Team': ['Alice', 'Bob'],
                'Blue Team': ['Charlie', 'David']
            };

            const knockoutBracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Red Team',
                    away: 'Blue Team',
                    homeScore: null,
                    awayScore: null
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // No points for incomplete matches
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('should handle draws (no winner)', () => {
            const teams = {
                'Red Team': ['Alice', 'Bob'],
                'Blue Team': ['Charlie', 'David']
            };

            const knockoutBracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Red Team',
                    away: 'Blue Team',
                    homeScore: 1,
                    awayScore: 1
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // No points for draws
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('should handle empty or null knockout bracket', () => {
            const teams = {
                'Red Team': ['Alice', 'Bob']
            };

            expect(rankingsManager.getKnockoutPoints(null, teams)).toEqual({});
            expect(rankingsManager.getKnockoutPoints([], teams)).toEqual({});
            expect(rankingsManager.getKnockoutPoints(undefined, teams)).toEqual({});
        });

        it('should handle missing team data', () => {
            const teams = {
                'Red Team': ['Alice', 'Bob']
            };

            const knockoutBracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Red Team',
                    away: 'Nonexistent Team',
                    homeScore: 2,
                    awayScore: 1
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // Only existing team gets points
            expect(result['Alice']).toBe(1);
            expect(result['Bob']).toBe(1);
        });

        it('should handle null/empty players in team', () => {
            const teams = {
                'Red Team': ['Alice', null, '', 'Bob']
            };

            const knockoutBracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Red Team',
                    away: 'Blue Team',
                    homeScore: 2,
                    awayScore: 1
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // Only valid players get points
            expect(result['Alice']).toBe(1);
            expect(result['Bob']).toBe(1);
            expect(result[null]).toBeUndefined();
            expect(result['']).toBeUndefined();
        });
    });
});
