import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnockoutManager, createKnockoutManager } from '$lib/server/knockoutManager.js';

// Mock the data service
vi.mock('$lib/server/data.js', () => ({
    data: {
        get: vi.fn(),
        set: vi.fn()
    }
}));

// Mock the standings manager
vi.mock('$lib/server/standings.js', () => ({
    createStandingsManager: vi.fn(() => ({
        getKnockoutBracketForDate: vi.fn()
    }))
}));

describe('KnockoutManager', () => {
    let knockoutManager;

    beforeEach(() => {
        vi.clearAllMocks();
        knockoutManager = createKnockoutManager();
    });

    describe('Factory function', () => {
        it('should create a new KnockoutManager instance', () => {
            const manager = createKnockoutManager();
            expect(manager).toBeInstanceOf(KnockoutManager);
        });
    });

    describe('advanceWinners', () => {
        it('should advance semi-final winners to final', () => {
            const bracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Team A',
                    away: 'Team B',
                    homeScore: 2,
                    awayScore: 1
                },
                {
                    round: 'semi',
                    match: 2,
                    home: 'Team C',
                    away: 'Team D',
                    homeScore: 1,
                    awayScore: 3
                },
                {
                    round: 'final',
                    match: 1,
                    home: null,
                    away: null,
                    homeScore: null,
                    awayScore: null
                }
            ];

            const result = knockoutManager.advanceWinners(bracket);

            expect(result[2].home).toBe('Team A'); // Winner of semi 1
            expect(result[2].away).toBe('Team D'); // Winner of semi 2
        });

        it('should handle incomplete matches by not advancing', () => {
            const bracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Team A',
                    away: 'Team B',
                    homeScore: 2,
                    awayScore: 1
                },
                {
                    round: 'semi',
                    match: 2,
                    home: 'Team C',
                    away: 'Team D',
                    homeScore: null,
                    awayScore: null
                },
                {
                    round: 'final',
                    match: 1,
                    home: null,
                    away: null,
                    homeScore: null,
                    awayScore: null
                }
            ];

            const result = knockoutManager.advanceWinners(bracket);

            expect(result[2].home).toBe('Team A'); // Winner of completed semi
            expect(result[2].away).toBe(null); // No winner from incomplete semi
        });

        it('should handle quarter-final to semi-final advancement', () => {
            const bracket = [
                {
                    round: 'quarter',
                    match: 1,
                    home: 'Team A',
                    away: 'Team E',
                    homeScore: 3,
                    awayScore: 1
                },
                {
                    round: 'quarter',
                    match: 2,
                    home: 'Team B',
                    away: 'Team F',
                    homeScore: 0,
                    awayScore: 2
                },
                {
                    round: 'quarter',
                    match: 3,
                    home: 'Team C',
                    away: 'Team G',
                    homeScore: 1,
                    awayScore: 0
                },
                {
                    round: 'quarter',
                    match: 4,
                    home: 'Team D',
                    away: 'Team H',
                    homeScore: 2,
                    awayScore: 2
                },
                {
                    round: 'semi',
                    match: 1,
                    home: null,
                    away: null,
                    homeScore: null,
                    awayScore: null
                },
                {
                    round: 'semi',
                    match: 2,
                    home: null,
                    away: null,
                    homeScore: null,
                    awayScore: null
                },
                {
                    round: 'final',
                    match: 1,
                    home: null,
                    away: null,
                    homeScore: null,
                    awayScore: null
                }
            ];

            const result = knockoutManager.advanceWinners(bracket);

            expect(result[4].home).toBe('Team A'); // Winner of quarter 1
            expect(result[4].away).toBe('Team F'); // Winner of quarter 2
            expect(result[5].home).toBe('Team C'); // Winner of quarter 3
            expect(result[5].away).toBe(null); // Draw in quarter 4, no advancement
        });

        it('should not advance draws', () => {
            const bracket = [
                {
                    round: 'semi',
                    match: 1,
                    home: 'Team A',
                    away: 'Team B',
                    homeScore: 1,
                    awayScore: 1
                },
                {
                    round: 'final',
                    match: 1,
                    home: null,
                    away: null,
                    homeScore: null,
                    awayScore: null
                }
            ];

            const result = knockoutManager.advanceWinners(bracket);

            expect(result[1].home).toBe(null); // No advancement for draw
        });
    });

    describe('getMatchWinner', () => {
        it('should return home team for home win', () => {
            const match = {
                home: 'Team A',
                away: 'Team B',
                homeScore: 2,
                awayScore: 1
            };

            const result = knockoutManager.getMatchWinner(match);
            expect(result).toBe('Team A');
        });

        it('should return away team for away win', () => {
            const match = {
                home: 'Team A',
                away: 'Team B',
                homeScore: 1,
                awayScore: 2
            };

            const result = knockoutManager.getMatchWinner(match);
            expect(result).toBe('Team B');
        });

        it('should return Draw for tied match', () => {
            const match = {
                home: 'Team A',
                away: 'Team B',
                homeScore: 1,
                awayScore: 1
            };

            const result = knockoutManager.getMatchWinner(match);
            expect(result).toBe('Draw');
        });

        it('should return null for incomplete match', () => {
            const match = {
                home: 'Team A',
                away: 'Team B',
                homeScore: null,
                awayScore: 1
            };

            const result = knockoutManager.getMatchWinner(match);
            expect(result).toBe(null);
        });
    });
});
