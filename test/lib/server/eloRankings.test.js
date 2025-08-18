import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEloRankingsManager } from '$lib/server/eloRankings.js';

describe('EloRankingsManager - Core Functions', () => {
    let eloManager;

    beforeEach(() => {
        eloManager = createEloRankingsManager();
    });

    describe('calculateExpectedScore', () => {
        it('should return 0.5 for equal ratings', () => {
            const result = eloManager.calculateExpectedScore(1000, 1000);
            expect(result).toBeCloseTo(0.5, 3);
        });

        it('should return higher probability for higher-rated team', () => {
            const result = eloManager.calculateExpectedScore(1200, 1000);
            expect(result).toBeGreaterThan(0.5);
            expect(result).toBeCloseTo(0.76, 2);
        });

        it('should return lower probability for lower-rated team', () => {
            const result = eloManager.calculateExpectedScore(800, 1000);
            expect(result).toBeLessThan(0.5);
            expect(result).toBeCloseTo(0.24, 2);
        });
    });

    describe('calculateActualScore', () => {
        it('should return 1 for home team win', () => {
            expect(eloManager.calculateActualScore(3, 1)).toBe(1);
            expect(eloManager.calculateActualScore(2, 0)).toBe(1);
        });

        it('should return 0 for home team loss', () => {
            expect(eloManager.calculateActualScore(1, 3)).toBe(0);
            expect(eloManager.calculateActualScore(0, 2)).toBe(0);
        });

        it('should return 0.5 for draw', () => {
            expect(eloManager.calculateActualScore(1, 1)).toBe(0.5);
            expect(eloManager.calculateActualScore(2, 2)).toBe(0.5);
        });
    });

    describe('calculateTeamRating', () => {
        const playerRatings = {
            Alice: { rating: 1200 },
            Bob: { rating: 1000 },
            Charlie: { rating: 800 },
            David: { rating: 1100 }
        };

        it('should calculate average rating correctly', () => {
            const players = ['Alice', 'Bob'];
            const result = eloManager.calculateTeamRating(players, playerRatings);
            expect(result).toBe(1100); // (1200 + 1000) / 2
        });

        it('should ignore null players', () => {
            const players = ['Alice', null, 'Bob', undefined];
            const result = eloManager.calculateTeamRating(players, playerRatings);
            expect(result).toBe(1100); // (1200 + 1000) / 2
        });

        it('should return baseline rating for team with no valid players', () => {
            const players = [null, undefined];
            const result = eloManager.calculateTeamRating(players, playerRatings);
            expect(result).toBe(1000); // Baseline rating
        });

        it('should use baseline rating for unknown players', () => {
            const players = ['Alice', 'UnknownPlayer'];
            const result = eloManager.calculateTeamRating(players, playerRatings);
            expect(result).toBe(1100); // (1200 + 1000) / 2
        });
    });

    describe('applyDecay', () => {
        it('should not change rating for 0 weeks', () => {
            const result = eloManager.applyDecay(1200, 0);
            expect(result).toBe(1200);
        });

        it('should pull rating toward baseline after decay', () => {
            const result = eloManager.applyDecay(1200, 1);
            expect(result).toBeLessThan(1200);
            expect(result).toBeGreaterThan(1000);
            expect(result).toBeCloseTo(1196, 0); // 1000 + (1200-1000) * 0.98
        });

        it('should pull low ratings up toward baseline', () => {
            const result = eloManager.applyDecay(800, 1);
            expect(result).toBeGreaterThan(800);
            expect(result).toBeLessThan(1000);
            expect(result).toBeCloseTo(804, 0); // 1000 + (800-1000) * 0.98
        });

        it('should compound decay over multiple weeks', () => {
            const result = eloManager.applyDecay(1200, 5);
            const expectedDecayFactor = Math.pow(0.98, 5);
            const expected = 1000 + (1200 - 1000) * expectedDecayFactor;
            expect(result).toBeCloseTo(expected, 1);
        });
    });

    describe('calculateWeeksElapsed', () => {
        it('should calculate weeks correctly', () => {
            const result = eloManager.calculateWeeksElapsed('2025-01-01', '2025-01-15');
            expect(result).toBe(2); // 14 days = 2 weeks
        });

        it('should return 0 for same date', () => {
            const result = eloManager.calculateWeeksElapsed('2025-01-01', '2025-01-01');
            expect(result).toBe(0);
        });

        it('should handle partial weeks', () => {
            const result = eloManager.calculateWeeksElapsed('2025-01-01', '2025-01-10');
            expect(result).toBe(1); // 9 days = 1 week (floored)
        });
    });
});

describe('EloRankingsManager - Game Processing', () => {
    let eloManager;
    let rankings;

    beforeEach(() => {
        eloManager = createEloRankingsManager();
        rankings = {
            players: {
                Alice: { rating: 1200, gamesPlayed: 5 },
                Bob: { rating: 1000, gamesPlayed: 3 },
                Charlie: { rating: 800, gamesPlayed: 2 },
                David: { rating: 1100, gamesPlayed: 4 }
            },
            processedSessions: [],
            lastUpdated: null
        };
    });

    describe('updateRatingsForGame', () => {
        it('should update ratings after a game', () => {
            const homeTeam = ['Alice', 'Bob'];
            const awayTeam = ['Charlie', 'David'];

            eloManager.updateRatingsForGame(rankings, homeTeam, awayTeam, 2, 1, 'league');

            // Check that ratings changed
            expect(rankings.players['Alice'].rating).not.toBe(1200);
            expect(rankings.players['Bob'].rating).not.toBe(1000);
            expect(rankings.players['Charlie'].rating).not.toBe(800);
            expect(rankings.players['David'].rating).not.toBe(1100);

            // Check that games played increased
            expect(rankings.players['Alice'].gamesPlayed).toBe(6);
            expect(rankings.players['Bob'].gamesPlayed).toBe(4);
            expect(rankings.players['Charlie'].gamesPlayed).toBe(3);
            expect(rankings.players['David'].gamesPlayed).toBe(5);
        });

        it('should increase ratings for winners and decrease for losers', () => {
            const initialHomeRating = rankings.players['Alice'].rating;
            const initialAwayRating = rankings.players['Charlie'].rating;

            const homeTeam = ['Alice'];
            const awayTeam = ['Charlie'];

            eloManager.updateRatingsForGame(rankings, homeTeam, awayTeam, 2, 0, 'league');

            // Home team (winner) should gain rating
            expect(rankings.players['Alice'].rating).toBeGreaterThan(initialHomeRating);
            // Away team (loser) should lose rating
            expect(rankings.players['Charlie'].rating).toBeLessThan(initialAwayRating);
        });

        it('should use different K-factors for league vs cup', () => {
            const homeTeam = ['Alice'];
            const awayTeam = ['Bob'];

            // Save initial ratings
            const initialAliceRating = rankings.players['Alice'].rating;
            const initialBobRating = rankings.players['Bob'].rating;

            // Test league game
            eloManager.updateRatingsForGame(rankings, homeTeam, awayTeam, 1, 0, 'league');
            const aliceAfterLeague = rankings.players['Alice'].rating;

            // Reset ratings
            rankings.players['Alice'].rating = initialAliceRating;
            rankings.players['Bob'].rating = initialBobRating;

            // Test cup game
            eloManager.updateRatingsForGame(rankings, homeTeam, awayTeam, 1, 0, 'cup');
            const aliceAfterCup = rankings.players['Alice'].rating;

            // Cup games should have smaller rating changes (K=7 vs K=10)
            const leagueChange = aliceAfterLeague - initialAliceRating;
            const cupChange = aliceAfterCup - initialAliceRating;
            expect(cupChange).toBeLessThan(leagueChange);
        });

        it('should handle null players in teams', () => {
            const homeTeam = ['Alice', null, 'Bob'];
            const awayTeam = [null, 'Charlie'];

            eloManager.updateRatingsForGame(rankings, homeTeam, awayTeam, 1, 0, 'league');

            // Only non-null players should be affected
            expect(rankings.players['Alice'].gamesPlayed).toBe(6);
            expect(rankings.players['Bob'].gamesPlayed).toBe(4);
            expect(rankings.players['Charlie'].gamesPlayed).toBe(3);
        });

        it('should create new players if they do not exist', () => {
            const homeTeam = ['NewPlayer'];
            const awayTeam = ['Alice'];

            eloManager.updateRatingsForGame(rankings, homeTeam, awayTeam, 1, 0, 'league');

            expect(rankings.players['NewPlayer']).toBeDefined();
            expect(rankings.players['NewPlayer'].rating).toBeGreaterThan(1000); // Should be higher than baseline after winning
            expect(rankings.players['NewPlayer'].gamesPlayed).toBe(1);
        });
    });
});

describe('EloRankingsManager - Activity Gate', () => {
    let eloManager;

    beforeEach(() => {
        eloManager = createEloRankingsManager();
    });

    describe('calculateSeedingScore', () => {
        it('should return rating when player has max attendance', async () => {
            // Mock buildAttendanceIndex - Alice has max attendance (10), Bob has less (8)
            vi.spyOn(eloManager, 'buildAttendanceIndex').mockResolvedValue({
                attendanceMap: { Alice: 10, Bob: 8 },
                sessionCount: 10
            });

            const playerData = { rating: 1200 };
            const leagueMinRating = 850;
            const result = await eloManager.calculateSeedingScore(
                'Alice',
                playerData,
                '2025-01-01',
                1.0,
                leagueMinRating
            );

            expect(result).toBe(1200); // Max attendance = full rating
        });

        it('should pull toward league minimum when activity factor is 0', async () => {
            // Mock buildAttendanceIndex - only Bob has attendance, Alice has none
            vi.spyOn(eloManager, 'buildAttendanceIndex').mockResolvedValue({
                attendanceMap: { Bob: 10 },
                sessionCount: 10
            });

            const playerData = { rating: 1200 };
            const leagueMinRating = 850;
            const result = await eloManager.calculateSeedingScore(
                'Alice',
                playerData,
                '2025-01-01',
                1.0,
                leagueMinRating
            );

            expect(result).toBe(850); // No activity = league minimum rating
        });

        it('should interpolate between league min and rating based on activity', async () => {
            // Mock buildAttendanceIndex - Bob has 10 sessions (max), Alice has 5
            vi.spyOn(eloManager, 'buildAttendanceIndex').mockResolvedValue({
                attendanceMap: { Alice: 5, Bob: 10, Charlie: 3 },
                sessionCount: 12
            });

            const playerData = { rating: 1200 };
            const leagueMinRating = 800;
            const result = await eloManager.calculateSeedingScore(
                'Alice',
                playerData,
                '2025-01-01',
                1.0,
                leagueMinRating
            );

            // 5/10 = 0.5 activity factor (compared to most active player Bob)
            // Expected: 800 + 0.5 * (1200 - 800) = 1000
            expect(result).toBe(1000);
        });

        it('should handle when only one player has attendance', async () => {
            // Mock buildAttendanceIndex - Only Alice has attendance
            vi.spyOn(eloManager, 'buildAttendanceIndex').mockResolvedValue({
                attendanceMap: { Alice: 7 },
                sessionCount: 10
            });

            const playerData = { rating: 1200 };
            const leagueMinRating = 900;
            const result = await eloManager.calculateSeedingScore(
                'Alice',
                playerData,
                '2025-01-01',
                1.0,
                leagueMinRating
            );

            // Alice has max attendance (7) so gets full rating
            expect(result).toBe(1200);
        });

        it('should fall back to baseline when no league min provided', async () => {
            // Mock buildAttendanceIndex - No one has attendance
            vi.spyOn(eloManager, 'buildAttendanceIndex').mockResolvedValue({
                attendanceMap: {},
                sessionCount: 10
            });

            const playerData = { rating: 1200 };
            const result = await eloManager.calculateSeedingScore(
                'Alice',
                playerData,
                '2025-01-01'
            );

            // No max attendance and no league min, so fall back to baseline
            expect(result).toBe(1000);
        });

        it('should use league minimum when rating is above it', async () => {
            // Mock buildAttendanceIndex - Alice has 25% attendance
            vi.spyOn(eloManager, 'buildAttendanceIndex').mockResolvedValue({
                attendanceMap: { Alice: 2, Bob: 8 },
                sessionCount: 10
            });

            const playerData = { rating: 1300 };
            const leagueMinRating = 700;
            const result = await eloManager.calculateSeedingScore(
                'Alice',
                playerData,
                '2025-01-01',
                1.0,
                leagueMinRating
            );

            // 2/8 = 0.25 activity factor
            // Expected: 700 + 0.25 * (1300 - 700) = 850
            expect(result).toBe(850);
        });
    });
});
