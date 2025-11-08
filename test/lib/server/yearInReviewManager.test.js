import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YearInReviewManager, createYearInReviewManager } from '$lib/server/yearInReviewManager.js';
import { createRankingsManager } from '$lib/server/rankings.js';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('$lib/server/rankings.js', () => ({
    createRankingsManager: vi.fn()
}));

describe('YearInReviewManager', () => {
    let manager;
    let mockRankingsManager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = createYearInReviewManager();
        manager.setLeague('test-league');

        // Mock rankings manager
        mockRankingsManager = {
            setLeague: vi.fn().mockReturnThis(),
            loadEnhancedRankings: vi.fn(),
            filterSessionFilesByYear: vi.fn((files, year) =>
                files.filter((f) => f.startsWith(`${year}-`))
            )
        };
        createRankingsManager.mockReturnValue(mockRankingsManager);
    });

    describe('Factory function', () => {
        it('should create a new YearInReviewManager instance', () => {
            const newManager = createYearInReviewManager();
            expect(newManager).toBeInstanceOf(YearInReviewManager);
        });
    });

    describe('Fluent interface', () => {
        it('should allow method chaining with setLeague', () => {
            const result = manager.setLeague('another-league');
            expect(result).toBe(manager);
        });

        it('should store league ID correctly', () => {
            manager.setLeague('my-league');
            expect(manager.leagueId).toBe('my-league');
        });
    });

    describe('calculateOverview', () => {
        it('should calculate overview statistics correctly', () => {
            const sessionDates = ['2025-01-01', '2025-01-08', '2025-01-15'];
            const sessions = [
                {
                    games: {
                        rounds: [
                            [
                                { home: 'red', away: 'blue', homeScore: 3, awayScore: 2 },
                                { home: 'green', away: 'yellow', homeScore: 1, awayScore: 1 }
                            ]
                        ]
                    }
                },
                {
                    games: {
                        rounds: [[{ home: 'red', away: 'green', homeScore: 2, awayScore: 0 }]]
                    }
                }
            ];
            const players = { Alice: {}, Bob: {}, Charlie: {} };

            const result = manager.calculateOverview(sessionDates, sessions, players);

            expect(result).toEqual({
                totalSessions: 3,
                totalMatches: 3,
                totalPlayers: 3,
                totalGoals: 9, // 3+2+1+1+2+0 = 9
                firstSession: '2025-01-01',
                lastSession: '2025-01-15'
            });
        });

        it('should handle empty sessions', () => {
            const result = manager.calculateOverview([], [], {});
            expect(result.totalSessions).toBe(0);
            expect(result.totalMatches).toBe(0);
            expect(result.totalGoals).toBe(0);
        });
    });

    describe('calculateIronManAward', () => {
        it('should return top 3 players by appearances', () => {
            const players = {
                Alice: { appearances: 10, rankingPoints: 100 },
                Bob: { appearances: 8, rankingPoints: 90 },
                Charlie: { appearances: 12, rankingPoints: 110 },
                Dave: { appearances: 5, rankingPoints: 50 }
            };

            const result = manager.calculateIronManAward(players);

            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('Charlie');
            expect(result[0].appearances).toBe(12);
            expect(result[1].name).toBe('Alice');
            expect(result[2].name).toBe('Bob');
        });

        it('should use total games as tiebreaker', () => {
            const players = {
                Alice: { appearances: 10, rankingPoints: 100 },
                Bob: { appearances: 10, rankingPoints: 90 }
            };

            const result = manager.calculateIronManAward(players);

            expect(result).toHaveLength(2);
            // Both have same appearances, so totalGames (appearances * 3) is same
            // Order should be stable
            expect(result[0].appearances).toBe(10);
            expect(result[1].appearances).toBe(10);
        });
    });

    describe('calculateMostImproved', () => {
        it('should calculate year-over-year improvement', () => {
            const players = {
                Alice: { rank: 3, rankingPoints: 100, rankingDetail: {} },
                Bob: { rank: 1, rankingPoints: 120, rankingDetail: {} },
                Charlie: { rank: 6, rankingPoints: 80, rankingDetail: {} }
            };
            const previousYear = {
                players: {
                    Alice: { rank: 10 },
                    Bob: { rank: 5 },
                    Charlie: { rank: 6 } // No change in rank
                }
            };

            const result = manager.calculateMostImproved(players, previousYear);

            expect(result).toHaveLength(2); // Only Alice and Bob improved
            expect(result[0].name).toBe('Alice'); // 10 -> 3 = +7
            expect(result[0].rankImprovement).toBe(7);
            expect(result[1].name).toBe('Bob'); // 5 -> 1 = +4
            expect(result[1].rankImprovement).toBe(4);
        });

        it('should fall back to within-year improvement', () => {
            const players = {
                Alice: {
                    rank: 3,
                    rankingPoints: 100,
                    rankingDetail: {
                        '2025-01-01': { rank: 10 },
                        '2025-12-31': { rank: 3 }
                    }
                }
            };
            const previousYear = null;

            const result = manager.calculateMostImproved(players, previousYear);

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alice');
            expect(result[0].rankImprovement).toBe(7); // 10 -> 3
        });

        it('should exclude players who declined in rank', () => {
            const players = {
                Alice: { rank: 10, rankingPoints: 50, rankingDetail: {} }
            };
            const previousYear = {
                players: {
                    Alice: { rank: 3 }
                }
            };

            const result = manager.calculateMostImproved(players, previousYear);

            expect(result).toHaveLength(0);
        });
    });

    describe('calculateKingOfKings', () => {
        it('should return top 3 players with most trophies', () => {
            const players = {
                Alice: { leagueWins: 3, cupWins: 2, rankingPoints: 100 },
                Bob: { leagueWins: 1, cupWins: 1, rankingPoints: 90 },
                Charlie: { leagueWins: 4, cupWins: 1, rankingPoints: 110 },
                Dave: { leagueWins: 0, cupWins: 0, rankingPoints: 50 }
            };

            const result = manager.calculateKingOfKings(players);

            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('Alice');
            expect(result[0].totalTrophies).toBe(5);
            expect(result[1].name).toBe('Charlie');
            expect(result[1].totalTrophies).toBe(5);
            expect(result[2].name).toBe('Bob');
            expect(result[2].totalTrophies).toBe(2);
        });

        it('should exclude players with no trophies', () => {
            const players = {
                Alice: { leagueWins: 0, cupWins: 0, rankingPoints: 100 },
                Bob: { rankingPoints: 90 }
            };

            const result = manager.calculateKingOfKings(players);

            expect(result).toHaveLength(0);
        });
    });

    describe('calculatePlayerOfYear', () => {
        it('should return top 3 players by ranking points', () => {
            const players = {
                Alice: { rankingPoints: 100, rank: 2, appearances: 10 },
                Bob: { rankingPoints: 120, rank: 1, appearances: 12 },
                Charlie: { rankingPoints: 90, rank: 3, appearances: 8 }
            };

            const result = manager.calculatePlayerOfYear(players);

            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('Bob');
            expect(result[0].rankingPoints).toBe(120);
            expect(result[1].name).toBe('Alice');
            expect(result[2].name).toBe('Charlie');
        });
    });

    describe('calculateTeamOfYear', () => {
        it('should return top 6 players by ranking points', () => {
            const players = {
                P1: { rankingPoints: 100, rank: 1 },
                P2: { rankingPoints: 95, rank: 2 },
                P3: { rankingPoints: 90, rank: 3 },
                P4: { rankingPoints: 85, rank: 4 },
                P5: { rankingPoints: 80, rank: 5 },
                P6: { rankingPoints: 75, rank: 6 },
                P7: { rankingPoints: 70, rank: 7 }
            };

            const result = manager.calculateTeamOfYear(players);

            expect(result).toHaveLength(6);
            expect(result[0].name).toBe('P1');
            expect(result[5].name).toBe('P6');
        });
    });

    describe('calculateTeamStats', () => {
        it('should identify best and worst teams per session', () => {
            const sessions = [
                {
                    date: '2025-01-01',
                    teams: {
                        'red lions': ['Alice', 'Bob'],
                        'blue eagles': ['Charlie', 'Dave']
                    },
                    games: {
                        rounds: [
                            [{ home: 'red lions', away: 'blue eagles', homeScore: 3, awayScore: 0 }]
                        ]
                    }
                },
                {
                    date: '2025-01-08',
                    teams: {
                        'red lions': ['Eve', 'Frank'],
                        'blue eagles': ['George', 'Helen']
                    },
                    games: {
                        rounds: [
                            [{ home: 'red lions', away: 'blue eagles', homeScore: 2, awayScore: 1 }]
                        ]
                    }
                }
            ];

            const result = manager.calculateTeamStats(sessions);

            expect(result.bestTeam).toBeDefined();
            expect(result.bestTeam.teamName).toBe('red lions');
            expect(result.bestTeam.wins).toBe(1);
            expect(result.bestTeam.sessionDate).toBe('2025-01-01'); // Best single team
            expect(result.bestTeam.goalDifference).toBe(3); // 3-0 in that session

            expect(result.worstTeam).toBeDefined();
            expect(result.worstTeam.teamName).toBe('blue eagles');
            expect(result.worstTeam.losses).toBe(1);
            // Either session could be worst, both have 1 loss
        });
    });

    describe('calculateFunFacts', () => {
        it('should identify highest scoring match', () => {
            const sessions = [
                {
                    date: '2025-01-01',
                    games: {
                        rounds: [
                            [
                                { home: 'red', away: 'blue', homeScore: 5, awayScore: 4 },
                                { home: 'green', away: 'yellow', homeScore: 1, awayScore: 1 }
                            ]
                        ]
                    }
                }
            ];

            const result = manager.calculateFunFacts(sessions);

            expect(result.highestScoringMatch).toBeDefined();
            expect(result.highestScoringMatch.totalGoals).toBe(9);
            expect(result.highestScoringMatch.homeScore).toBe(5);
            expect(result.highestScoringMatch.awayScore).toBe(4);
        });

        it('should identify biggest margin win', () => {
            const sessions = [
                {
                    date: '2025-01-01',
                    games: {
                        rounds: [
                            [
                                { home: 'red', away: 'blue', homeScore: 6, awayScore: 0 },
                                { home: 'green', away: 'yellow', homeScore: 2, awayScore: 1 }
                            ]
                        ]
                    }
                }
            ];

            const result = manager.calculateFunFacts(sessions);

            expect(result.biggestMarginWin).toBeDefined();
            expect(result.biggestMarginWin.margin).toBe(6);
        });

        it('should track most and fewest goals in a session', () => {
            const sessions = [
                {
                    date: '2025-01-01',
                    games: {
                        rounds: [[{ home: 'red', away: 'blue', homeScore: 5, awayScore: 5 }]]
                    }
                },
                {
                    date: '2025-01-08',
                    games: {
                        rounds: [[{ home: 'red', away: 'blue', homeScore: 1, awayScore: 0 }]]
                    }
                }
            ];

            const result = manager.calculateFunFacts(sessions);

            expect(result.mostGoalsSession.goals).toBe(10);
            expect(result.mostGoalsSession.date).toBe('2025-01-01');
            expect(result.fewestGoalsSession.goals).toBe(1);
            expect(result.fewestGoalsSession.date).toBe('2025-01-08');
        });

        it('should skip sessions with no completed games', () => {
            const sessions = [
                {
                    date: '2025-01-01',
                    games: {
                        rounds: [[{ home: 'red', away: 'blue', homeScore: 5, awayScore: 5 }]]
                    }
                },
                {
                    date: '2025-01-08',
                    games: {
                        rounds: [[{ home: 'red', away: 'blue', homeScore: null, awayScore: null }]]
                    }
                },
                {
                    date: '2025-01-15',
                    games: {
                        rounds: [[{ home: 'red', away: 'blue', homeScore: 2, awayScore: 1 }]]
                    }
                }
            ];

            const result = manager.calculateFunFacts(sessions);

            // Should not count the session with null scores (2025-01-08)
            expect(result.fewestGoalsSession.goals).toBe(3); // 2025-01-15
            expect(result.fewestGoalsSession.date).toBe('2025-01-15');
            expect(result.mostGoalsSession.goals).toBe(10); // 2025-01-01
        });
    });

    describe('generateYearInReview', () => {
        it('should throw error when no data available', async () => {
            mockRankingsManager.loadEnhancedRankings.mockResolvedValue({
                calculatedDates: [],
                players: {}
            });

            await expect(manager.generateYearInReview(2025)).rejects.toThrow(
                'No data available for this year'
            );
        });

        it('should generate complete year in review statistics', async () => {
            const mockRankingsData = {
                calculatedDates: ['2025-01-01'],
                players: {
                    Alice: {
                        rank: 1,
                        rankingPoints: 100,
                        appearances: 10,
                        leagueWins: 2,
                        cupWins: 1,
                        rankingDetail: {}
                    }
                }
            };

            mockRankingsManager.loadEnhancedRankings.mockResolvedValueOnce(mockRankingsData);
            mockRankingsManager.loadEnhancedRankings.mockResolvedValueOnce(null); // No previous year

            fs.readdir.mockResolvedValue(['2025-01-01.json']);
            fs.readFile.mockResolvedValue(
                JSON.stringify({
                    teams: { red: ['Alice'] },
                    games: { rounds: [[{ home: 'red', away: 'blue', homeScore: 2, awayScore: 1 }]] }
                })
            );

            const result = await manager.generateYearInReview(2025);

            expect(result).toHaveProperty('overview');
            expect(result).toHaveProperty('ironManAward');
            expect(result).toHaveProperty('mostImproved');
            expect(result).toHaveProperty('kingOfKings');
            expect(result).toHaveProperty('playerOfYear');
            expect(result).toHaveProperty('teamOfYear');
            expect(result).toHaveProperty('invincibles');
            expect(result).toHaveProperty('underdogs');
            expect(result).toHaveProperty('funFacts');
        });
    });
});
