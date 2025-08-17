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

    describe('Ranking Detail Structure', () => {
        it('should include rankingDetail in player data structure', () => {
            const rawRankings = {
                players: {
                    Alice: {
                        points: 6,
                        appearances: 2,
                        rankingDetail: {
                            '2024-01-01': {
                                team: 'Red Team',
                                appearancePoints: 1,
                                matchPoints: 3,
                                bonusPoints: 0,
                                knockoutPoints: 0,
                                totalPoints: 4
                            },
                            '2024-01-02': {
                                team: 'Blue Team',
                                appearancePoints: 1,
                                matchPoints: 1,
                                bonusPoints: 0,
                                knockoutPoints: 0,
                                totalPoints: 2
                            }
                        }
                    }
                }
            };

            const enhanced = rankingsManager.calculateEnhancedRankings(rawRankings);

            expect(enhanced.players['Alice'].rankingDetail).toBeDefined();
            expect(enhanced.players['Alice'].rankingDetail['2024-01-01']).toEqual({
                team: 'Red Team',
                appearancePoints: 1,
                matchPoints: 3,
                bonusPoints: 0,
                knockoutPoints: 0,
                totalPoints: 4
            });
        });

        it('should preserve ranking detail through enhancement process', () => {
            const rawRankings = {
                players: {
                    Alice: {
                        points: 13,
                        appearances: 1,
                        rankingDetail: {
                            '2024-01-01': {
                                team: 'Red Team',
                                appearancePoints: 1,
                                matchPoints: 6,
                                bonusPoints: 2,
                                knockoutPoints: 4,
                                totalPoints: 13
                            }
                        }
                    }
                }
            };

            const enhanced = rankingsManager.calculateEnhancedRankings(rawRankings);

            expect(enhanced.players['Alice'].rankingDetail['2024-01-01'].knockoutPoints).toBe(4);
            expect(enhanced.players['Alice'].points).toBe(13);
            expect(enhanced.players['Alice'].appearances).toBe(1);
        });
    });

    describe('Points Breakdown Calculation', () => {
        it('should correctly calculate point breakdown components', () => {
            const teams = {
                'Red Team': ['Alice'],
                'Blue Team': ['Bob']
            };

            const knockoutBracket = [
                {
                    round: 'final',
                    match: 1,
                    home: 'Red Team',
                    away: 'Blue Team',
                    homeScore: 2,
                    awayScore: 1
                }
            ];

            const playerKnockoutWins = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // Alice should have 1 knockout win
            expect(playerKnockoutWins['Alice']).toBe(1);

            // With KNOCKOUT_MULTIPLIER = 4, knockout points should be 4
            const knockoutPoints = playerKnockoutWins['Alice'] * 4;
            expect(knockoutPoints).toBe(4);
        });
    });

    describe('Movement Calculation (Legacy Tests - now using history-based method)', () => {
        it('should calculate correct movement for existing players', () => {
            const enhancedRankings = {
                players: {
                    Alice: {
                        rank: 1,
                        rankingDetail: {
                            '2024-01-01': { rank: 3 },
                            '2024-01-02': { rank: 1 }
                        }
                    },
                    Bob: {
                        rank: 2,
                        rankingDetail: {
                            '2024-01-01': { rank: 1 },
                            '2024-01-02': { rank: 2 }
                        }
                    },
                    Charlie: {
                        rank: 3,
                        rankingDetail: {
                            '2024-01-01': { rank: 2 },
                            '2024-01-02': { rank: 3 }
                        }
                    }
                }
            };

            rankingsManager.calculateMovementFromHistory(enhancedRankings);

            // Alice moved up from rank 3 to rank 1 (movement = +2)
            expect(enhancedRankings.players.Alice.rankMovement).toBe(2);
            expect(enhancedRankings.players.Alice.previousRank).toBe(3);
            expect(enhancedRankings.players.Alice.isNew).toBe(false);

            // Bob moved down from rank 1 to rank 2 (movement = -1)
            expect(enhancedRankings.players.Bob.rankMovement).toBe(-1);
            expect(enhancedRankings.players.Bob.previousRank).toBe(1);
            expect(enhancedRankings.players.Bob.isNew).toBe(false);

            // Charlie moved down from rank 2 to rank 3 (movement = -1)
            expect(enhancedRankings.players.Charlie.rankMovement).toBe(-1);
            expect(enhancedRankings.players.Charlie.previousRank).toBe(2);
            expect(enhancedRankings.players.Charlie.isNew).toBe(false);
        });

        it('should mark new players correctly', () => {
            const enhancedRankings = {
                players: {
                    Alice: {
                        rank: 1,
                        rankingDetail: {
                            '2024-01-01': { rank: 1 },
                            '2024-01-02': { rank: 1 }
                        }
                    },
                    Bob: {
                        rank: 2,
                        rankingDetail: {
                            '2024-01-01': { rank: 2 },
                            '2024-01-02': { rank: 2 }
                        }
                    },
                    NewPlayer: {
                        rank: 3,
                        rankingDetail: {
                            '2024-01-02': { rank: 3 } // Only one entry = new player
                        }
                    }
                }
            };

            rankingsManager.calculateMovementFromHistory(enhancedRankings);

            expect(enhancedRankings.players.NewPlayer.isNew).toBe(true);
            expect(enhancedRankings.players.NewPlayer.rankMovement).toBe(0);
            expect(enhancedRankings.players.NewPlayer.previousRank).toBeNull();
        });

        it('should handle no previous rankings (empty history)', () => {
            const enhancedRankings = {
                players: {
                    Alice: {
                        rank: 1,
                        rankingDetail: {
                            '2024-01-01': { rank: 1 } // Only one entry
                        }
                    },
                    Bob: {
                        rank: 2,
                        rankingDetail: {
                            '2024-01-01': { rank: 2 } // Only one entry
                        }
                    }
                }
            };

            rankingsManager.calculateMovementFromHistory(enhancedRankings);

            expect(enhancedRankings.players.Alice.isNew).toBe(true);
            expect(enhancedRankings.players.Alice.rankMovement).toBe(0);
            expect(enhancedRankings.players.Alice.previousRank).toBeNull();

            expect(enhancedRankings.players.Bob.isNew).toBe(true);
            expect(enhancedRankings.players.Bob.rankMovement).toBe(0);
            expect(enhancedRankings.players.Bob.previousRank).toBeNull();
        });

        it('should handle same rank (no movement)', () => {
            const enhancedRankings = {
                players: {
                    Alice: {
                        rank: 1,
                        rankingDetail: {
                            '2024-01-01': { rank: 1 },
                            '2024-01-02': { rank: 1 }
                        }
                    },
                    Bob: {
                        rank: 2,
                        rankingDetail: {
                            '2024-01-01': { rank: 2 },
                            '2024-01-02': { rank: 2 }
                        }
                    }
                }
            };

            rankingsManager.calculateMovementFromHistory(enhancedRankings);

            expect(enhancedRankings.players.Alice.rankMovement).toBe(0);
            expect(enhancedRankings.players.Bob.rankMovement).toBe(0);
            expect(enhancedRankings.players.Alice.isNew).toBe(false);
            expect(enhancedRankings.players.Bob.isNew).toBe(false);
        });
    });

    describe('Complete Ranking History', () => {
        it('should store rank for every date from first appearance onwards', () => {
            const playerTracker = new Map();

            // Simulate player appearing for first time on date1
            playerTracker.set('Alice', {
                points: 10,
                appearances: 1,
                rankingDetail: {
                    '2024-01-01': {
                        team: 'Red Team',
                        totalPoints: 10,
                        rank: 1,
                        totalPlayers: 2
                    }
                }
            });

            playerTracker.set('Bob', {
                points: 5,
                appearances: 1,
                rankingDetail: {
                    '2024-01-01': {
                        team: 'Blue Team',
                        totalPoints: 5,
                        rank: 2,
                        totalPlayers: 2
                    }
                }
            });

            // Update for date2 where only Bob appears
            const playersWhoAppeared = new Set(['Bob']);
            rankingsManager.updateRanksForDate('2024-01-02', playerTracker, playersWhoAppeared);

            // Alice should have non-appearance entry for date2
            const aliceDetail = playerTracker.get('Alice').rankingDetail['2024-01-02'];
            expect(aliceDetail.team).toBeNull();
            expect(aliceDetail.totalPoints).toBeNull();
            expect(aliceDetail.rank).toBeDefined();
            expect(aliceDetail.totalPlayers).toBeDefined();

            // Bob should have appearance entry but team data would be set elsewhere
            const bobDetail = playerTracker.get('Bob').rankingDetail['2024-01-02'];
            expect(bobDetail.rank).toBeDefined();
        });

        it('should calculate movement from complete history', () => {
            const enhancedRankings = {
                players: {
                    Alice: {
                        rankingDetail: {
                            '2024-01-01': { rank: 3 },
                            '2024-01-02': { rank: 1 }
                        }
                    },
                    Bob: {
                        rankingDetail: {
                            '2024-01-01': { rank: 1 }
                        }
                    }
                }
            };

            rankingsManager.calculateMovementFromHistory(enhancedRankings);

            // Alice moved up from rank 3 to rank 1 (+2)
            expect(enhancedRankings.players.Alice.rankMovement).toBe(2);
            expect(enhancedRankings.players.Alice.previousRank).toBe(3);
            expect(enhancedRankings.players.Alice.isNew).toBe(false);

            // Bob only has one entry, so is considered new
            expect(enhancedRankings.players.Bob.isNew).toBe(true);
            expect(enhancedRankings.players.Bob.rankMovement).toBe(0);
        });

        it('should handle empty ranking detail in movement calculation', () => {
            const enhancedRankings = {
                players: {
                    Alice: {
                        rankingDetail: {}
                    }
                }
            };

            rankingsManager.calculateMovementFromHistory(enhancedRankings);

            expect(enhancedRankings.players.Alice.isNew).toBe(true);
            expect(enhancedRankings.players.Alice.rankMovement).toBe(0);
            expect(enhancedRankings.players.Alice.previousRank).toBeNull();
        });
    });

    describe('hasCompletedGames', () => {
        it('should return true when session has completed league games', () => {
            const sessionData = {
                games: {
                    rounds: [
                        [
                            {
                                home: 'Red Team',
                                away: 'Blue Team',
                                homeScore: 2,
                                awayScore: 1
                            }
                        ]
                    ]
                }
            };

            const result = rankingsManager.hasCompletedGames(sessionData);
            expect(result).toBe(true);
        });

        it('should return true when session has completed knockout games', () => {
            const sessionData = {
                games: {
                    rounds: [],
                    'knockout-games': {
                        bracket: [
                            {
                                round: 'final',
                                home: 'Red Team',
                                away: 'Blue Team',
                                homeScore: 1,
                                awayScore: 0
                            }
                        ]
                    }
                }
            };

            const result = rankingsManager.hasCompletedGames(sessionData);
            expect(result).toBe(true);
        });

        it('should return false when session has no games at all', () => {
            const sessionData = {
                games: {
                    rounds: []
                }
            };

            const result = rankingsManager.hasCompletedGames(sessionData);
            expect(result).toBe(false);
        });

        it('should return false when session has games but no scores', () => {
            const sessionData = {
                games: {
                    rounds: [
                        [
                            {
                                home: 'Red Team',
                                away: 'Blue Team',
                                homeScore: null,
                                awayScore: null
                            }
                        ]
                    ]
                }
            };

            const result = rankingsManager.hasCompletedGames(sessionData);
            expect(result).toBe(false);
        });

        it('should return false when session data is empty', () => {
            const sessionData = {};

            const result = rankingsManager.hasCompletedGames(sessionData);
            expect(result).toBe(false);
        });

        it('should return false when session has teams but no games structure', () => {
            const sessionData = {
                teams: {
                    'Red Team': ['Alice'],
                    'Blue Team': ['Bob']
                }
            };

            const result = rankingsManager.hasCompletedGames(sessionData);
            expect(result).toBe(false);
        });
    });
});
