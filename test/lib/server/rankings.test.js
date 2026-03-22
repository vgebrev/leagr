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

        it('should award points for bye matches - team vs BYE', () => {
            const teams = {
                'Red Team': ['Alice', 'Bob'],
                BYE: []
            };

            const knockoutBracket = [
                {
                    round: 'semi',
                    home: 'Red Team',
                    away: 'BYE',
                    bye: true,
                    homeScore: null,
                    awayScore: null
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // Red Team players should get knockout points for bye match
            expect(result['Alice']).toBe(1);
            expect(result['Bob']).toBe(1);
        });

        it('should award points for bye matches - BYE vs team', () => {
            const teams = {
                'Blue Team': ['Charlie', 'David'],
                BYE: []
            };

            const knockoutBracket = [
                {
                    round: 'semi',
                    home: 'BYE',
                    away: 'Blue Team',
                    bye: true,
                    homeScore: null,
                    awayScore: null
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // Blue Team players should get knockout points for bye match
            expect(result['Charlie']).toBe(1);
            expect(result['David']).toBe(1);
        });

        it('should handle mix of bye matches and regular matches', () => {
            const teams = {
                'Red Team': ['Alice', 'Bob'],
                'Blue Team': ['Charlie', 'David'],
                'Green Team': ['Eve', 'Frank'],
                BYE: []
            };

            const knockoutBracket = [
                // First semi: Red Team gets bye
                {
                    round: 'semi',
                    home: 'Red Team',
                    away: 'BYE',
                    bye: true,
                    homeScore: null,
                    awayScore: null
                },
                // Second semi: Blue Team wins regular match
                {
                    round: 'semi',
                    home: 'Blue Team',
                    away: 'Green Team',
                    homeScore: 2,
                    awayScore: 1
                },
                // Final: Red Team wins
                {
                    round: 'final',
                    home: 'Red Team',
                    away: 'Blue Team',
                    homeScore: 3,
                    awayScore: 1
                }
            ];

            const result = rankingsManager.getKnockoutPoints(knockoutBracket, teams);

            // Red Team won 2 matches (bye semi + final)
            expect(result['Alice']).toBe(2);
            expect(result['Bob']).toBe(2);

            // Blue Team won 1 match (semi)
            expect(result['Charlie']).toBe(1);
            expect(result['David']).toBe(1);

            // Green Team won nothing
            expect(result['Eve']).toBeUndefined();
            expect(result['Frank']).toBeUndefined();
        });
    });

    describe('Ranking Detail Structure', () => {
        it('should include history in player data structure', () => {
            const rawRankings = {
                players: {
                    Alice: {
                        points: 6,
                        appearances: 2,
                        history: {
                            '2024-01-01': {
                                team: 'Red Team',
                                points: { appearance: 1, match: 3, bonus: 0, knockout: 0, total: 4 }
                            },
                            '2024-01-02': {
                                team: 'Blue Team',
                                points: { appearance: 1, match: 1, bonus: 0, knockout: 0, total: 2 }
                            }
                        }
                    }
                }
            };

            const enhanced = rankingsManager.calculateEnhancedRankings(rawRankings);

            expect(enhanced.players['Alice'].history).toBeDefined();
            expect(enhanced.players['Alice'].history['2024-01-01']).toEqual({
                team: 'Red Team',
                points: { appearance: 1, match: 3, bonus: 0, knockout: 0, total: 4 }
            });
        });

        it('should preserve ranking detail through enhancement process', () => {
            const rawRankings = {
                players: {
                    Alice: {
                        points: 13,
                        appearances: 1,
                        history: {
                            '2024-01-01': {
                                team: 'Red Team',
                                points: {
                                    appearance: 1,
                                    match: 6,
                                    bonus: 2,
                                    knockout: 4,
                                    total: 13
                                }
                            }
                        }
                    }
                }
            };

            const enhanced = rankingsManager.calculateEnhancedRankings(rawRankings);

            expect(enhanced.players['Alice'].history['2024-01-01'].points.knockout).toBe(4);
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
                        history: {
                            '2024-01-01': { ranking: { rank: 3 } },
                            '2024-01-02': { ranking: { rank: 1 } }
                        }
                    },
                    Bob: {
                        rank: 2,
                        history: {
                            '2024-01-01': { ranking: { rank: 1 } },
                            '2024-01-02': { ranking: { rank: 2 } }
                        }
                    },
                    Charlie: {
                        rank: 3,
                        history: {
                            '2024-01-01': { ranking: { rank: 2 } },
                            '2024-01-02': { ranking: { rank: 3 } }
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
                        history: {
                            '2024-01-01': { ranking: { rank: 1 } },
                            '2024-01-02': { ranking: { rank: 1 } }
                        }
                    },
                    Bob: {
                        rank: 2,
                        history: {
                            '2024-01-01': { ranking: { rank: 2 } },
                            '2024-01-02': { ranking: { rank: 2 } }
                        }
                    },
                    NewPlayer: {
                        rank: 3,
                        history: {
                            '2024-01-02': { ranking: { rank: 3 } } // Only one entry = new player
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
                        history: {
                            '2024-01-01': { ranking: { rank: 1 } } // Only one entry
                        }
                    },
                    Bob: {
                        rank: 2,
                        history: {
                            '2024-01-01': { ranking: { rank: 2 } } // Only one entry
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
                        history: {
                            '2024-01-01': { ranking: { rank: 1 } },
                            '2024-01-02': { ranking: { rank: 1 } }
                        }
                    },
                    Bob: {
                        rank: 2,
                        history: {
                            '2024-01-01': { ranking: { rank: 2 } },
                            '2024-01-02': { ranking: { rank: 2 } }
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
                history: {
                    '2024-01-01': {
                        team: 'Red Team',
                        points: { total: 10 },
                        ranking: { rank: 1, totalPlayers: 2 }
                    }
                }
            });

            playerTracker.set('Bob', {
                points: 5,
                appearances: 1,
                history: {
                    '2024-01-01': {
                        team: 'Blue Team',
                        points: { total: 5 },
                        ranking: { rank: 2, totalPlayers: 2 }
                    }
                }
            });

            // Update for date2 where only Bob appears
            const playersWhoAppeared = new Set(['Bob']);
            rankingsManager.updateRanksForDate('2024-01-02', playerTracker, playersWhoAppeared);

            // Alice should have non-appearance entry for date2
            const aliceDetail = playerTracker.get('Alice').history['2024-01-02'];
            expect('points' in aliceDetail).toBe(false);
            expect(aliceDetail.ranking.rank).toBeDefined();
            expect(aliceDetail.ranking.totalPlayers).toBeDefined();

            // Bob should have appearance entry but team data would be set elsewhere
            const bobDetail = playerTracker.get('Bob').history['2024-01-02'];
            expect(bobDetail.ranking.rank).toBeDefined();
        });

        it('should calculate movement from complete history', () => {
            const enhancedRankings = {
                players: {
                    Alice: {
                        history: {
                            '2024-01-01': { ranking: { rank: 3 } },
                            '2024-01-02': { ranking: { rank: 1 } }
                        }
                    },
                    Bob: {
                        history: {
                            '2024-01-01': { ranking: { rank: 1 } }
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
                        history: {}
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

    describe('ELO Integration', () => {
        describe('calculateExpectedScore', () => {
            it('should calculate expected scores correctly', () => {
                // Equal ratings should give 0.5 expected score
                expect(rankingsManager.calculateExpectedScore(1000, 1000)).toBeCloseTo(0.5, 2);

                // Higher rating should give >0.5 expected score
                expect(rankingsManager.calculateExpectedScore(1200, 1000)).toBeGreaterThan(0.5);

                // Lower rating should give <0.5 expected score
                expect(rankingsManager.calculateExpectedScore(1000, 1200)).toBeLessThan(0.5);
            });
        });

        describe('calculateActualScore', () => {
            it('should calculate actual scores correctly', () => {
                expect(rankingsManager.calculateActualScore(2, 1)).toBe(1); // Win
                expect(rankingsManager.calculateActualScore(1, 2)).toBe(0); // Loss
                expect(rankingsManager.calculateActualScore(1, 1)).toBe(0.5); // Draw
            });
        });

        describe('calculateMarginMultiplier', () => {
            it('should return 1.0 for draws', () => {
                expect(rankingsManager.calculateMarginMultiplier(0)).toBe(1.0);
            });

            it('should return 1.0 for 1-goal margins', () => {
                expect(rankingsManager.calculateMarginMultiplier(1)).toBe(1.0);
                expect(rankingsManager.calculateMarginMultiplier(-1)).toBe(1.0);
            });

            it('should return 1.15 for 2-goal margins', () => {
                expect(rankingsManager.calculateMarginMultiplier(2)).toBe(1.15);
                expect(rankingsManager.calculateMarginMultiplier(-2)).toBe(1.15);
            });

            it('should return 1.25 for 3-goal margins', () => {
                expect(rankingsManager.calculateMarginMultiplier(3)).toBe(1.25);
                expect(rankingsManager.calculateMarginMultiplier(-3)).toBe(1.25);
            });

            it('should cap at 1.3 for 4+ goal margins', () => {
                expect(rankingsManager.calculateMarginMultiplier(4)).toBe(1.3);
                expect(rankingsManager.calculateMarginMultiplier(5)).toBe(1.3);
                expect(rankingsManager.calculateMarginMultiplier(10)).toBe(1.3);
                expect(rankingsManager.calculateMarginMultiplier(-4)).toBe(1.3);
                expect(rankingsManager.calculateMarginMultiplier(-10)).toBe(1.3);
            });
        });

        describe('calculateTeamEloRating', () => {
            it('should calculate team average ELO rating', () => {
                const players = ['Alice', 'Bob'];
                const playerRatings = {
                    Alice: { elo: { rating: 1200 } },
                    Bob: { elo: { rating: 1000 } }
                };

                const teamRating = rankingsManager.calculateTeamEloRating(players, playerRatings);
                expect(teamRating).toBe(1100); // (1200 + 1000) / 2
            });

            it('should handle missing ELO data with baseline rating', () => {
                const players = ['Alice', 'Bob'];
                const playerRatings = {
                    Alice: { elo: { rating: 1200 } },
                    Bob: {} // No ELO data
                };

                const teamRating = rankingsManager.calculateTeamEloRating(players, playerRatings);
                expect(teamRating).toBe(1100); // (1200 + 1000) / 2
            });

            it('should filter out null players', () => {
                const players = ['Alice', null, 'Bob'];
                const playerRatings = {
                    Alice: { elo: { rating: 1200 } },
                    Bob: { elo: { rating: 1000 } }
                };

                const teamRating = rankingsManager.calculateTeamEloRating(players, playerRatings);
                expect(teamRating).toBe(1100); // Still (1200 + 1000) / 2
            });
        });

        describe('applyEloDecay', () => {
            it('should apply weekly decay correctly', () => {
                const originalRating = 1200;
                const weeksElapsed = 2;

                const newRating = rankingsManager.applyEloDecay(originalRating, weeksElapsed);

                // Should decay toward baseline (1000)
                expect(newRating).toBeLessThan(originalRating);
                expect(newRating).toBeGreaterThan(1000);

                // More precise calculation: 1000 + (1200-1000) * (0.98^2) with 2% decay
                const expectedRating = 1000 + (1200 - 1000) * Math.pow(0.98, 2);
                expect(newRating).toBeCloseTo(expectedRating, 2);
            });

            it('should not decay if no weeks elapsed', () => {
                const originalRating = 1200;
                const weeksElapsed = 0;

                const newRating = rankingsManager.applyEloDecay(originalRating, weeksElapsed);
                expect(newRating).toBe(originalRating);
            });

            it('should handle negative weeks', () => {
                const originalRating = 1200;
                const weeksElapsed = -1;

                const newRating = rankingsManager.applyEloDecay(originalRating, weeksElapsed);
                expect(newRating).toBe(originalRating);
            });
        });

        describe('applyEloDecayToAllPlayers', () => {
            it('should use first session date as baseline for initial decay', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 10,
                    appearances: 2,
                    history: {
                        '2024-01-01': { points: { total: 5 } },
                        '2024-01-08': { points: { total: 5 } }
                    },
                    elo: {
                        rating: 1200,
                        lastDecayAt: null, // Never decayed
                        gamesPlayed: 2
                    }
                });

                // Process session 2 weeks after first session
                rankingsManager.applyEloDecayToAllPlayers(playerTracker, '2024-01-15');

                const alice = playerTracker.get('Alice');

                // Should have decayed from first session date (2024-01-01)
                expect(alice.elo.rating).toBeLessThan(1200);
                expect(alice.elo.lastDecayAt).toBe('2024-01-15');

                // Calculate expected rating: 2 weeks from 2024-01-01 to 2024-01-15 with 2% decay
                const expectedRating = 1000 + (1200 - 1000) * Math.pow(0.98, 2);
                expect(alice.elo.rating).toBeCloseTo(expectedRating, 2);
            });

            it('should not decay on same date as last decay', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 10,
                    appearances: 1,
                    history: {
                        '2024-01-01': { points: { total: 10 } }
                    },
                    elo: {
                        rating: 1200,
                        lastDecayAt: '2024-01-01',
                        gamesPlayed: 1
                    }
                });

                // Process same session date
                rankingsManager.applyEloDecayToAllPlayers(playerTracker, '2024-01-01');

                const alice = playerTracker.get('Alice');
                expect(alice.elo.rating).toBe(1200); // No decay
                expect(alice.elo.lastDecayAt).toBe('2024-01-01'); // Unchanged
            });
        });

        describe('calculateWeeksElapsed', () => {
            it('should calculate weeks elapsed correctly', () => {
                const fromDate = '2024-01-01';
                const toDate = '2024-01-15'; // 14 days = 2 weeks

                const weeks = rankingsManager.calculateWeeksElapsed(fromDate, toDate);
                expect(weeks).toBe(2);
            });

            it('should handle partial weeks', () => {
                const fromDate = '2024-01-01';
                const toDate = '2024-01-10'; // 9 days = 1 week (floored)

                const weeks = rankingsManager.calculateWeeksElapsed(fromDate, toDate);
                expect(weeks).toBe(1);
            });
        });

        describe('updateEloRatingsForGame', () => {
            it('should update ELO ratings after a game', () => {
                const playerTracker = new Map();

                // Initialize players
                playerTracker.set('Alice', { elo: { rating: 1000, gamesPlayed: 0 } });
                playerTracker.set('Bob', { elo: { rating: 1000, gamesPlayed: 0 } });

                const homeTeam = ['Alice'];
                const awayTeam = ['Bob'];

                rankingsManager.updateEloRatingsForGame(
                    playerTracker,
                    homeTeam,
                    awayTeam,
                    2,
                    0,
                    'league'
                );

                // Winner should gain points, loser should lose points
                const alice = playerTracker.get('Alice');
                const bob = playerTracker.get('Bob');

                expect(alice.elo.rating).toBeGreaterThan(1000);
                expect(bob.elo.rating).toBeLessThan(1000);
                expect(alice.elo.gamesPlayed).toBe(1);
                expect(bob.elo.gamesPlayed).toBe(1);
            });

            it('should initialize ELO data for new players', () => {
                const playerTracker = new Map();

                // Player without ELO data
                playerTracker.set('Alice', { points: 10, appearances: 1 });

                const homeTeam = ['Alice'];
                const awayTeam = ['Bob']; // Bob doesn't exist yet

                // This should initialize both players
                rankingsManager.updateEloRatingsForGame(
                    playerTracker,
                    homeTeam,
                    awayTeam,
                    1,
                    1,
                    'league'
                );

                const alice = playerTracker.get('Alice');
                expect(alice.elo).toBeDefined();
                expect(alice.elo.rating).toBe(1000); // Should start at baseline due to draw
                expect(alice.elo.gamesPlayed).toBe(1);
            });
        });

        describe('ELO rating in ranking detail', () => {
            it('should include ELO rating in ranking detail for appearances', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 0,
                    appearances: 0,
                    history: {},
                    elo: { rating: 1150, gamesPlayed: 5 }
                });

                const playersWhoAppeared = new Set(['Alice']);
                rankingsManager.updateRanksForDate('2024-01-01', playerTracker, playersWhoAppeared);

                const alice = playerTracker.get('Alice');
                expect(alice.history['2024-01-01'].ratings.elo).toBe(1150);
            });

            it('should include ELO rating in ranking detail for non-appearances', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 10,
                    appearances: 1,
                    history: {},
                    elo: { rating: 1150, gamesPlayed: 5 }
                });

                const playersWhoAppeared = new Set(); // Alice didn't appear
                rankingsManager.updateRanksForDate('2024-01-02', playerTracker, playersWhoAppeared);

                const alice = playerTracker.get('Alice');
                expect(alice.history['2024-01-02'].ratings.elo).toBe(1150);
                expect('points' in alice.history['2024-01-02']).toBe(false);
            });

            it('should use baseline rating when no ELO data exists', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 0,
                    appearances: 0,
                    history: {}
                    // No ELO data
                });

                const playersWhoAppeared = new Set(['Alice']);
                rankingsManager.updateRanksForDate('2024-01-01', playerTracker, playersWhoAppeared);

                const alice = playerTracker.get('Alice');
                expect(alice.history['2024-01-01'].ratings.elo).toBe(1000);
            });
        });

        describe('ELO object in enhanced rankings', () => {
            it('should include ELO object in enhanced player data', () => {
                const rawRankings = {
                    players: {
                        Alice: {
                            points: 10,
                            appearances: 1,
                            history: {},
                            elo: {
                                rating: 1150,
                                lastDecayAt: '2024-01-01',
                                gamesPlayed: 5
                            }
                        },
                        Bob: {
                            points: 8,
                            appearances: 1,
                            history: {}
                            // No ELO data
                        }
                    }
                };

                const enhanced = rankingsManager.calculateEnhancedRankings(rawRankings);

                // Alice should have ELO data
                expect(enhanced.players.Alice.elo).toBeDefined();
                expect(enhanced.players.Alice.elo.rating).toBe(1150);
                expect(enhanced.players.Alice.elo.lastDecayAt).toBe('2024-01-01');
                expect(enhanced.players.Alice.elo.gamesPlayed).toBe(5);

                // Bob should have null ELO data
                expect(enhanced.players.Bob.elo).toBeNull();
            });
        });

        describe('ELO processing with knockout bye matches', () => {
            it('should skip ELO processing for bye matches', () => {
                const playerTracker = new Map();

                // Initialize players with baseline ratings
                playerTracker.set('Alice', {
                    elo: { rating: 1000, gamesPlayed: 0, lastDecayAt: null }
                });
                playerTracker.set('Bob', {
                    elo: { rating: 1000, gamesPlayed: 0, lastDecayAt: null }
                });

                const teams = {
                    'Red Team': ['Alice', 'Bob'],
                    'Blue Team': ['Charlie', 'David']
                };

                const knockoutBracket = [
                    // Bye match - should not affect ELO
                    {
                        round: 'semi',
                        home: 'Red Team',
                        away: 'BYE',
                        bye: true,
                        homeScore: null,
                        awayScore: null
                    },
                    // Regular match - should affect ELO
                    {
                        round: 'semi',
                        home: 'Blue Team',
                        away: 'Green Team',
                        homeScore: 2,
                        awayScore: 1
                    }
                ];

                // Process ELO for knockout matches
                rankingsManager.processEloRatings(
                    playerTracker,
                    teams,
                    [],
                    knockoutBracket,
                    '2024-01-01'
                );

                // Red Team players should have unchanged ELO (bye match)
                const alice = playerTracker.get('Alice');
                const bob = playerTracker.get('Bob');
                expect(alice.elo.rating).toBe(1000); // Unchanged
                expect(alice.elo.gamesPlayed).toBe(0); // No game played
                expect(bob.elo.rating).toBe(1000); // Unchanged
                expect(bob.elo.gamesPlayed).toBe(0); // No game played
            });
        });
    });
});

describe('RankingsManager - Yearly Rankings', () => {
    let rankingsManager;

    beforeEach(() => {
        rankingsManager = createRankingsManager();
    });

    describe('getRankingsPath', () => {
        it('should return path with year when year is specified', () => {
            rankingsManager.setLeague('test-league');
            const path = rankingsManager.getRankingsPath(2025);
            expect(path).toContain('rankings-2025.json');
        });

        it('should return path with current year when year is not specified', () => {
            rankingsManager.setLeague('test-league');
            const currentYear = new Date().getFullYear();
            const path = rankingsManager.getRankingsPath();
            expect(path).toContain(`rankings-${currentYear}.json`);
        });

        it('should handle different years correctly', () => {
            rankingsManager.setLeague('test-league');
            const path2024 = rankingsManager.getRankingsPath(2024);
            const path2025 = rankingsManager.getRankingsPath(2025);
            expect(path2024).toContain('rankings-2024.json');
            expect(path2025).toContain('rankings-2025.json');
        });
    });

    describe('filterSessionFilesByYear', () => {
        it('should filter files to only include specified year', () => {
            const files = [
                '2024-05-24.json',
                '2024-06-07.json',
                '2025-01-15.json',
                '2025-03-22.json',
                '2025-12-31.json',
                '2026-01-01.json'
            ];

            const filtered2024 = rankingsManager.filterSessionFilesByYear(files, 2024);
            expect(filtered2024).toEqual(['2024-05-24.json', '2024-06-07.json']);

            const filtered2025 = rankingsManager.filterSessionFilesByYear(files, 2025);
            expect(filtered2025).toEqual(['2025-01-15.json', '2025-03-22.json', '2025-12-31.json']);
        });

        it('should return empty array when no files match year', () => {
            const files = ['2024-05-24.json', '2024-06-07.json'];
            const filtered = rankingsManager.filterSessionFilesByYear(files, 2025);
            expect(filtered).toEqual([]);
        });

        it('should handle empty file list', () => {
            const filtered = rankingsManager.filterSessionFilesByYear([], 2025);
            expect(filtered).toEqual([]);
        });
    });

    describe('loadPreviousYearElo', () => {
        it('should extract ELO ratings from previous year rankings', () => {
            const previousRankings = {
                players: {
                    Alice: {
                        elo: {
                            rating: 1050,
                            lastDecayAt: '2024-12-31',
                            gamesPlayed: 10
                        },
                        history: {
                            '2024-12-07': { team: 'Blue', points: { total: 5 } },
                            '2024-12-14': { team: 'White', points: { total: 6 } },
                            '2024-12-21': { team: 'Blue', points: { total: 7 } }
                        }
                    },
                    Bob: {
                        elo: {
                            rating: 980,
                            lastDecayAt: '2024-12-31',
                            gamesPlayed: 8
                        },
                        history: {
                            '2024-12-07': { team: 'White', points: { total: 4 } },
                            '2024-12-21': { team: 'Blue', points: { total: 5 } }
                        }
                    },
                    Charlie: {
                        elo: {
                            rating: 1120,
                            lastDecayAt: '2024-12-31',
                            gamesPlayed: 15
                        },
                        history: {
                            '2024-12-14': { team: 'Blue', points: { total: 8 } },
                            '2024-12-28': { team: 'White', points: { total: 9 } }
                        }
                    }
                }
            };

            const eloCarryOver = rankingsManager.loadPreviousYearElo(previousRankings);

            expect(eloCarryOver).toEqual({
                Alice: { rating: 1050, gamesPlayed: 10, lastAppearance: '2024-12-21' },
                Bob: { rating: 980, gamesPlayed: 8, lastAppearance: '2024-12-21' },
                Charlie: { rating: 1120, gamesPlayed: 15, lastAppearance: '2024-12-28' }
            });
        });

        it('should return empty object when no previous rankings', () => {
            const eloCarryOver = rankingsManager.loadPreviousYearElo(null);
            expect(eloCarryOver).toEqual({});
        });

        it('should return empty object when previous rankings has no players', () => {
            const previousRankings = {
                players: {}
            };
            const eloCarryOver = rankingsManager.loadPreviousYearElo(previousRankings);
            expect(eloCarryOver).toEqual({});
        });

        it('should handle players without ELO data', () => {
            const previousRankings = {
                players: {
                    Alice: {
                        elo: {
                            rating: 1050,
                            lastDecayAt: '2024-12-31',
                            gamesPlayed: 10
                        },
                        history: {
                            '2024-12-21': { team: 'Blue', points: { total: 7 } }
                        }
                    },
                    Bob: {
                        // No ELO data
                    }
                }
            };

            const eloCarryOver = rankingsManager.loadPreviousYearElo(previousRankings);

            expect(eloCarryOver).toEqual({
                Alice: { rating: 1050, gamesPlayed: 10, lastAppearance: '2024-12-21' }
            });
        });
    });

    describe('initializePlayerWithCarryOverElo', () => {
        it('should initialize player with carried-over ELO', () => {
            const eloCarryOver = {
                Alice: { rating: 1050, gamesPlayed: 10, lastAppearance: '2024-12-21' },
                Bob: { rating: 980, gamesPlayed: 8, lastAppearance: '2024-12-14' }
            };

            const playerData = rankingsManager.initializePlayerWithCarryOverElo(
                'Alice',
                eloCarryOver
            );

            expect(playerData.elo.rating).toBe(1050);
            expect(playerData.elo.gamesPlayed).toBe(10); // Carry over games played
            expect(playerData.elo.lastDecayAt).toBe('2024-12-21'); // Carry over last appearance for decay
            expect(playerData.points).toBe(0);
            expect(playerData.appearances).toBe(0);
        });

        it('should initialize player with baseline ELO when not in carry-over', () => {
            const eloCarryOver = {
                Alice: { rating: 1050, gamesPlayed: 10 }
            };

            const playerData = rankingsManager.initializePlayerWithCarryOverElo(
                'Bob',
                eloCarryOver
            );

            expect(playerData.elo.rating).toBe(1000); // ELO_BASELINE_RATING
            expect(playerData.elo.gamesPlayed).toBe(0);
            expect(playerData.elo.lastDecayAt).toBeNull();
        });

        it('should initialize player with baseline ELO when carry-over is empty', () => {
            const playerData = rankingsManager.initializePlayerWithCarryOverElo('Alice', {});

            expect(playerData.elo.rating).toBe(1000); // ELO_BASELINE_RATING
            expect(playerData.elo.gamesPlayed).toBe(0);
        });
    });

    describe('Performance Tracking', () => {
        describe('getLeaguePositions', () => {
            it('should convert 0-indexed standings to 1-indexed positions', () => {
                const standings = {
                    'Red Team': 0,
                    'Blue Team': 1,
                    'Green Team': 2,
                    'Yellow Team': 3
                };

                const positions = rankingsManager.getLeaguePositions(standings);

                expect(positions['Red Team']).toBe(1);
                expect(positions['Blue Team']).toBe(2);
                expect(positions['Green Team']).toBe(3);
                expect(positions['Yellow Team']).toBe(4);
            });

            it('should handle empty standings', () => {
                const positions = rankingsManager.getLeaguePositions({});
                expect(positions).toEqual({});
            });

            it('should handle single team', () => {
                const standings = { 'Red Team': 0 };
                const positions = rankingsManager.getLeaguePositions(standings);
                expect(positions['Red Team']).toBe(1);
            });
        });

        describe('getTeamCupProgress', () => {
            it('should identify cup winner', () => {
                const bracket = [
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
                        homeScore: 3,
                        awayScore: 1
                    },
                    {
                        round: 'final',
                        match: 1,
                        home: 'Red Team',
                        away: 'Green Team',
                        homeScore: 2,
                        awayScore: 1
                    }
                ];

                const progress = rankingsManager.getTeamCupProgress(bracket);

                expect(progress['Red Team']).toBe('winner');
                expect(progress['Green Team']).toBe('final');
                expect(progress['Blue Team']).toBe('semi');
                expect(progress['Yellow Team']).toBe('semi');
            });

            it('should handle teams eliminated in different rounds', () => {
                const bracket = [
                    {
                        round: 'quarter',
                        match: 1,
                        home: 'Team A',
                        away: 'Team B',
                        homeScore: 2,
                        awayScore: 1
                    },
                    {
                        round: 'quarter',
                        match: 2,
                        home: 'Team C',
                        away: 'Team D',
                        homeScore: 1,
                        awayScore: 0
                    },
                    {
                        round: 'semi',
                        match: 1,
                        home: 'Team A',
                        away: 'Team C',
                        homeScore: 3,
                        awayScore: 2
                    },
                    {
                        round: 'final',
                        match: 1,
                        home: 'Team A',
                        away: 'Other Team',
                        homeScore: 1,
                        awayScore: 2
                    }
                ];

                const progress = rankingsManager.getTeamCupProgress(bracket);

                expect(progress['Team A']).toBe('final');
                expect(progress['Team C']).toBe('semi');
                expect(progress['Team B']).toBe('quarter');
                expect(progress['Team D']).toBe('quarter');
                expect(progress['Other Team']).toBe('winner');
            });

            it('should handle round-of-16 and other named rounds', () => {
                const bracket = [
                    {
                        round: 'round-of-16',
                        match: 1,
                        home: 'Team A',
                        away: 'Team B',
                        homeScore: 2,
                        awayScore: 0
                    },
                    {
                        round: 'quarter',
                        match: 1,
                        home: 'Team A',
                        away: 'Team C',
                        homeScore: 1,
                        awayScore: 2
                    },
                    {
                        round: 'semi',
                        match: 1,
                        home: 'Team C',
                        away: 'Team D',
                        homeScore: 2,
                        awayScore: 1
                    },
                    {
                        round: 'final',
                        match: 1,
                        home: 'Team C',
                        away: 'Team E',
                        homeScore: 3,
                        awayScore: 1
                    }
                ];

                const progress = rankingsManager.getTeamCupProgress(bracket);

                expect(progress['Team A']).toBe('quarter');
                expect(progress['Team B']).toBe('round-of-16');
                expect(progress['Team C']).toBe('winner');
                expect(progress['Team D']).toBe('semi');
                expect(progress['Team E']).toBe('final');
            });

            it('should handle round-of-32 format', () => {
                const bracket = [
                    {
                        round: 'round-of-32',
                        match: 1,
                        home: 'Team A',
                        away: 'Team B',
                        homeScore: 2,
                        awayScore: 1
                    },
                    {
                        round: 'round-of-16',
                        match: 1,
                        home: 'Team A',
                        away: 'Team C',
                        homeScore: 0,
                        awayScore: 1
                    },
                    {
                        round: 'quarter',
                        match: 1,
                        home: 'Team C',
                        away: 'Team D',
                        homeScore: 2,
                        awayScore: 0
                    },
                    {
                        round: 'semi',
                        match: 1,
                        home: 'Team C',
                        away: 'Team E',
                        homeScore: 1,
                        awayScore: 0
                    },
                    {
                        round: 'final',
                        match: 1,
                        home: 'Team C',
                        away: 'Team F',
                        homeScore: 2,
                        awayScore: 1
                    }
                ];

                const progress = rankingsManager.getTeamCupProgress(bracket);

                expect(progress['Team A']).toBe('round-of-16');
                expect(progress['Team B']).toBe('round-of-32');
                expect(progress['Team C']).toBe('winner');
                expect(progress['Team D']).toBe('quarter');
                expect(progress['Team E']).toBe('semi');
                expect(progress['Team F']).toBe('final');
            });

            it('should return empty object when bracket is null', () => {
                const progress = rankingsManager.getTeamCupProgress(null);
                expect(progress).toEqual({});
            });

            it('should return empty object when bracket is undefined', () => {
                const progress = rankingsManager.getTeamCupProgress(undefined);
                expect(progress).toEqual({});
            });

            it('should return empty object when no completed matches', () => {
                const bracket = [
                    {
                        round: 'semi',
                        match: 1,
                        home: 'Red Team',
                        away: 'Blue Team',
                        homeScore: null,
                        awayScore: null
                    }
                ];

                const progress = rankingsManager.getTeamCupProgress(bracket);
                expect(progress).toEqual({});
            });

            it('should ignore incomplete matches but process complete ones', () => {
                const bracket = [
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
                        homeScore: null,
                        awayScore: null
                    },
                    {
                        round: 'final',
                        match: 1,
                        home: 'Red Team',
                        away: 'TBD',
                        homeScore: null,
                        awayScore: null
                    }
                ];

                const progress = rankingsManager.getTeamCupProgress(bracket);

                expect(progress['Red Team']).toBe('semi');
                expect(progress['Blue Team']).toBe('semi');
                expect(progress['Green Team']).toBeUndefined();
                expect(progress['Yellow Team']).toBeUndefined();
            });

            it('should track furthest round when team plays multiple rounds', () => {
                const bracket = [
                    {
                        round: 'quarter',
                        match: 1,
                        home: 'Team A',
                        away: 'Team B',
                        homeScore: 2,
                        awayScore: 0
                    },
                    {
                        round: 'semi',
                        match: 1,
                        home: 'Team A',
                        away: 'Team C',
                        homeScore: 3,
                        awayScore: 1
                    },
                    {
                        round: 'final',
                        match: 1,
                        home: 'Team A',
                        away: 'Team D',
                        homeScore: 0,
                        awayScore: 1
                    }
                ];

                const progress = rankingsManager.getTeamCupProgress(bracket);

                // Team A reached final but didn't win
                expect(progress['Team A']).toBe('final');
                // Team D won the cup
                expect(progress['Team D']).toBe('winner');
            });
        });
    });
});

// ---------------------------------------------------------------------------
// Individual stats collection & composite attack/control ratings
// ---------------------------------------------------------------------------

describe('RankingsManager - Individual stats & composite ratings', () => {
    let rankingsManager;

    beforeEach(() => {
        rankingsManager = createRankingsManager();
    });

    // -------------------------------------------------------------------------
    // collectIndividualStatsForSession
    // -------------------------------------------------------------------------
    describe('collectIndividualStatsForSession', () => {
        const teams = {
            'Red Team': ['Alice', 'Bob'],
            'Blue Team': ['Charlie', 'David']
        };

        it('extracts goals from homeScorers and awayScorers', () => {
            const rounds = [
                [
                    {
                        home: 'Red Team',
                        away: 'Blue Team',
                        homeScore: 2,
                        awayScore: 1,
                        homeScorers: { Alice: 2 },
                        awayScorers: { Charlie: 1 }
                    }
                ]
            ];
            const { stats, tracked } = rankingsManager.collectIndividualStatsForSession(
                rounds,
                null,
                teams
            );
            expect(stats.Alice.goals).toBe(2);
            expect(stats.Charlie.goals).toBe(1);
            expect(stats.Bob.goals).toBe(0);
            expect(stats.David.goals).toBe(0);
            expect(tracked.goals).toBe(true);
            expect(tracked.offActions).toBe(false);
        });

        it('extracts offensive, defensive and save actions', () => {
            const rounds = [
                [
                    {
                        home: 'Red Team',
                        away: 'Blue Team',
                        homeScore: 1,
                        awayScore: 1,
                        homeOffensiveActions: { Alice: 3 },
                        homeDefensiveActions: { Bob: 2 },
                        awaySaveActions: { David: 4 },
                        awayDefensiveActions: { Charlie: 1 }
                    }
                ]
            ];
            const { stats, tracked } = rankingsManager.collectIndividualStatsForSession(
                rounds,
                null,
                teams
            );
            expect(stats.Alice.offensiveActions).toBe(3);
            expect(stats.Bob.defensiveActions).toBe(2);
            expect(stats.David.saveActions).toBe(4);
            expect(stats.Charlie.defensiveActions).toBe(1);
            expect(tracked.offActions).toBe(true);
            expect(tracked.defActions).toBe(true);
            expect(tracked.saveActions).toBe(true);
        });

        it('accumulates stats across multiple matches and rounds', () => {
            const rounds = [
                [
                    {
                        home: 'Red Team',
                        away: 'Blue Team',
                        homeScore: 1,
                        awayScore: 0,
                        homeScorers: { Alice: 1 },
                        homeOffensiveActions: { Alice: 1 }
                    }
                ],
                [
                    {
                        home: 'Blue Team',
                        away: 'Red Team',
                        homeScore: 0,
                        awayScore: 2,
                        awayScorers: { Alice: 2 }
                    }
                ]
            ];
            const { stats } = rankingsManager.collectIndividualStatsForSession(rounds, null, teams);
            expect(stats.Alice.goals).toBe(3);
            expect(stats.Alice.offensiveActions).toBe(1);
        });

        it('accumulates stats from knockout bracket', () => {
            const rounds = [];
            const knockoutBracket = [
                {
                    home: 'Red Team',
                    away: 'Blue Team',
                    homeScore: 2,
                    awayScore: 0,
                    homeScorers: { Bob: 2 },
                    homeSaveActions: { Bob: 1 }
                }
            ];
            const { stats } = rankingsManager.collectIndividualStatsForSession(
                rounds,
                knockoutBracket,
                teams
            );
            expect(stats.Bob.goals).toBe(2);
            expect(stats.Bob.saveActions).toBe(1);
        });

        it('skips reserved scorer keys (__ownGoal__, __unassigned__)', () => {
            const rounds = [
                [
                    {
                        home: 'Red Team',
                        away: 'Blue Team',
                        homeScore: 2,
                        awayScore: 0,
                        homeScorers: { Alice: 1, __ownGoal__: 1, __unassigned__: 1 }
                    }
                ]
            ];
            const { stats } = rankingsManager.collectIndividualStatsForSession(rounds, null, teams);
            expect(stats.Alice.goals).toBe(1);
            expect(stats['__ownGoal__']).toBeUndefined();
            expect(stats['__unassigned__']).toBeUndefined();
        });

        it('handles missing action maps gracefully (null / undefined)', () => {
            const rounds = [
                [
                    {
                        home: 'Red Team',
                        away: 'Blue Team',
                        homeScore: 1,
                        awayScore: 0
                        // no scorers or action fields at all
                    }
                ]
            ];
            expect(() =>
                rankingsManager.collectIndividualStatsForSession(rounds, null, teams)
            ).not.toThrow();
            const { stats, tracked } = rankingsManager.collectIndividualStatsForSession(
                rounds,
                null,
                teams
            );
            expect(stats.Alice.goals).toBe(0);
            expect(tracked.goals).toBe(false);
            expect(tracked.offActions).toBe(false);
        });

        it('initialises zero stats for every player in teams regardless of contributions', () => {
            const rounds = [
                [
                    {
                        home: 'Red Team',
                        away: 'Blue Team',
                        homeScore: 1,
                        awayScore: 0,
                        homeScorers: { Alice: 1 }
                    }
                ]
            ];
            const { stats } = rankingsManager.collectIndividualStatsForSession(rounds, null, teams);
            // Bob scored nothing — should still be present with 0s
            expect(stats.Bob).toBeDefined();
            expect(stats.Bob.goals).toBe(0);
            expect(stats.Bob.offensiveActions).toBe(0);
            expect(stats.Bob.defensiveActions).toBe(0);
            expect(stats.Bob.saveActions).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // calculateAttackControlRatings — composite formula
    // -------------------------------------------------------------------------
    describe('calculateAttackControlRatings — composite with individual stats', () => {
        /**
         * Build a minimal enhancedRankings object with two players for a single date.
         * Alice is high-goals/high-offActions; Bob is high-saves/high-defActions.
         */
        function buildRankings({ aliceStats, bobStats }) {
            const mkEntry = (stats, seasonEloGames = 40) => ({
                team: 'Red Team',
                points: { total: 5 },
                ratings: {
                    elo: 1000,
                    eloGames: { allTime: seasonEloGames, season: seasonEloGames },
                    attacking: null,
                    control: null,
                    teamGF: { perSession: stats.gf },
                    teamGA: { perSession: stats.ga },
                    goals: { perSession: stats.goals },
                    offActions: { perSession: stats.off },
                    defActions: { perSession: stats.def },
                    saveActions: { perSession: stats.save }
                },
                ranking: { rank: 1, totalPlayers: 2, rankingPoints: 10 }
            });

            return {
                players: {
                    Alice: {
                        history: { '2026-01-10': mkEntry(aliceStats) },
                        elo: { gamesPlayed: 40 }
                    },
                    Bob: { history: { '2026-01-10': mkEntry(bobStats) }, elo: { gamesPlayed: 40 } }
                }
            };
        }

        it('attackingRating is higher for the player with more individual goals on same team', () => {
            const rankings = buildRankings({
                aliceStats: { gf: 10, ga: 8, goals: 3, off: 2, def: 0, save: 0 },
                bobStats: { gf: 10, ga: 8, goals: 0, off: 0, def: 2, save: 3 }
            });
            rankingsManager.calculateAttackControlRatings(rankings);
            expect(rankings.players.Alice.attackingRating).toBeGreaterThan(
                rankings.players.Bob.attackingRating
            );
        });

        it('controlRating is higher for the player with more saves/defActions', () => {
            const rankings = buildRankings({
                aliceStats: { gf: 10, ga: 8, goals: 3, off: 2, def: 0, save: 0 },
                bobStats: { gf: 10, ga: 8, goals: 0, off: 0, def: 3, save: 2 }
            });
            rankingsManager.calculateAttackControlRatings(rankings);
            expect(rankings.players.Bob.controlRating).toBeGreaterThan(
                rankings.players.Alice.controlRating
            );
        });

        it('falls back to team-GF/GA only when all individual stats are zero', () => {
            // Two players on different teams: Alice on high-GF team, Bob on low-GF team
            // Both have zero individual stats — result should mirror the old team-only formula
            const mkEntry = (gf, ga, eloGames = 40) => ({
                team: 'X',
                points: { total: 5 },
                ratings: {
                    elo: 1000,
                    eloGames: { allTime: eloGames, season: eloGames },
                    attacking: null,
                    control: null,
                    teamGF: { perSession: gf },
                    teamGA: { perSession: ga },
                    goals: { perSession: 0 },
                    offActions: { perSession: 0 },
                    defActions: { perSession: 0 },
                    saveActions: { perSession: 0 }
                },
                ranking: { rank: 1, totalPlayers: 2, rankingPoints: 10 }
            });
            const rankings = {
                players: {
                    Alice: { history: { '2026-01-10': mkEntry(10, 5) }, elo: { gamesPlayed: 40 } },
                    Bob: { history: { '2026-01-10': mkEntry(5, 10) }, elo: { gamesPlayed: 40 } }
                }
            };
            rankingsManager.calculateAttackControlRatings(rankings);
            // Alice (high GF) should have higher attacking than Bob
            expect(rankings.players.Alice.attackingRating).toBeGreaterThan(
                rankings.players.Bob.attackingRating
            );
            // Bob (high GA) should have lower control than Alice
            expect(rankings.players.Alice.controlRating).toBeGreaterThan(
                rankings.players.Bob.controlRating
            );
        });

        it('stores individual normalised values on history entry', () => {
            const rankings = buildRankings({
                aliceStats: { gf: 10, ga: 5, goals: 3, off: 2, def: 0, save: 0 },
                bobStats: { gf: 8, ga: 8, goals: 0, off: 1, def: 2, save: 3 }
            });
            rankingsManager.calculateAttackControlRatings(rankings);
            const entry = rankings.players.Alice.history['2026-01-10'].ratings;
            expect(entry.goals).toHaveProperty('norm');
            expect(entry.offActions).toHaveProperty('norm');
            expect(entry.defActions).toHaveProperty('norm');
            expect(entry.saveActions).toHaveProperty('norm');
            expect(entry.goals.norm).toBeGreaterThanOrEqual(0);
            expect(entry.goals.norm).toBeLessThanOrEqual(1);
        });

        it('produces ratings in [0, 1] range', () => {
            const rankings = buildRankings({
                aliceStats: { gf: 12, ga: 4, goals: 4, off: 3, def: 0, save: 0 },
                bobStats: { gf: 6, ga: 9, goals: 0, off: 0, def: 3, save: 4 }
            });
            rankingsManager.calculateAttackControlRatings(rankings);
            for (const p of Object.values(rankings.players)) {
                if (p.attackingRating !== null) {
                    expect(p.attackingRating).toBeGreaterThanOrEqual(0);
                    expect(p.attackingRating).toBeLessThanOrEqual(1);
                }
                if (p.controlRating !== null) {
                    expect(p.controlRating).toBeGreaterThanOrEqual(0);
                    expect(p.controlRating).toBeLessThanOrEqual(1);
                }
            }
        });
    });

    // -------------------------------------------------------------------------
    // calculatePlayerProfiles — trait assignment
    // -------------------------------------------------------------------------
    describe('calculatePlayerProfiles', () => {
        /**
         * Build minimal enhancedRankings where each player has pre-computed
         * latest normalised stats on their top-level data.
         * Each player entry: { g, o, d, s, sg } — sg defaults to 35 (established, full confidence).
         * Dynamic threshold = mean of established players' pulled norms + 0.1 per stat.
         * Tests use a High/Low pair so the threshold is predictable:
         *   mean = (high + low) / 2, threshold = mean + 0.1
         */
        function buildWithNorms(players) {
            const result = { players: {} };
            for (const [name, norms] of Object.entries(players)) {
                result.players[name] = {
                    goalsNorm: norms.g ?? 0,
                    offActionsNorm: norms.o ?? 0,
                    defActionsNorm: norms.d ?? 0,
                    saveActionsNorm: norms.s ?? 0,
                    seasonEloGames: norms.sg ?? 35,
                    history: {}
                };
            }
            return result;
        }

        // Alice=0.8, Bob=0.2 → mean=0.5, threshold=0.6 → Alice passes, Bob doesn't
        it('assigns isFinisher when pulled goals norm is above dynamic threshold', () => {
            const r = buildWithNorms({ Alice: { g: 0.8 }, Bob: { g: 0.2 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isFinisher).toBe(true);
            expect(r.players.Bob.traits.isFinisher).toBe(false);
        });

        it('assigns isAttacker when pulled off norm is above dynamic threshold', () => {
            const r = buildWithNorms({ Alice: { o: 0.8 }, Bob: { o: 0.2 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isAttacker).toBe(true);
            expect(r.players.Bob.traits.isAttacker).toBe(false);
        });

        it('assigns isDefender when pulled def norm is above dynamic threshold', () => {
            const r = buildWithNorms({ Alice: { d: 0.8 }, Bob: { d: 0.2 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isDefender).toBe(true);
            expect(r.players.Bob.traits.isDefender).toBe(false);
        });

        it('assigns isShotStopper when pulled save norm is above dynamic threshold', () => {
            const r = buildWithNorms({ Alice: { s: 0.8 }, Bob: { s: 0.2 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isShotStopper).toBe(true);
            expect(r.players.Bob.traits.isShotStopper).toBe(false);
        });

        // Badge tests: Alice high, Low zeroed → threshold = Alice/2 + 0.1 < Alice → Alice passes
        it('Finisher + Attacker = Danger Man', () => {
            const r = buildWithNorms({ Alice: { g: 0.8, o: 0.8 }, Low: {} });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.playerProfile).toContain('Danger Man');
        });

        it('Defender + Attacker = Engine', () => {
            const r = buildWithNorms({ Alice: { d: 0.8, o: 0.8 }, Low: {} });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.playerProfile).toContain('Engine');
        });

        it('Defender + Shot Stopper = Sentinel', () => {
            const r = buildWithNorms({ Alice: { d: 0.8, s: 0.8 }, Low: {} });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.playerProfile).toContain('Sentinel');
        });

        it('Attacker + Finisher + Defender = Complete Player (plus sub-badges)', () => {
            const r = buildWithNorms({ Alice: { g: 0.8, o: 0.8, d: 0.8 }, Low: {} });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.playerProfile).toContain('Complete Player');
            expect(r.players.Alice.playerProfile).toContain('Danger Man');
            expect(r.players.Alice.playerProfile).toContain('Engine');
            expect(r.players.Alice.playerProfile).not.toContain('Goal-Scoring Defender');
        });

        it('all 4 traits = G.O.A.T. plus all sub-badges', () => {
            const r = buildWithNorms({ Alice: { g: 0.8, o: 0.8, d: 0.8, s: 0.8 }, Low: {} });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isFinisher).toBe(true);
            expect(r.players.Alice.traits.isAttacker).toBe(true);
            expect(r.players.Alice.traits.isDefender).toBe(true);
            expect(r.players.Alice.traits.isShotStopper).toBe(true);
            expect(r.players.Alice.playerProfile).toContain('G.O.A.T.');
            expect(r.players.Alice.playerProfile).toContain('Complete Player');
            expect(r.players.Alice.playerProfile).toContain('Sentinel');
        });

        it('no traits when all norms clearly below dynamic threshold', () => {
            // Alice low, Bob high → threshold well above Alice
            // g: mean=(0.1+0.9)/2=0.5, thresh=0.6 → Alice(0.1) fails
            const r = buildWithNorms({
                Alice: { g: 0.1, o: 0.05, d: 0.02, s: 0.0 },
                Bob: { g: 0.9, o: 0.8, d: 0.7, s: 0.6 }
            });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isFinisher).toBe(false);
            expect(r.players.Alice.traits.isAttacker).toBe(false);
            expect(r.players.Alice.traits.isDefender).toBe(false);
            expect(r.players.Alice.traits.isShotStopper).toBe(false);
            expect(r.players.Alice.playerProfile).toEqual([]);
        });

        it('no individual stats = empty badge array', () => {
            const r = buildWithNorms({ Alice: {}, Bob: { g: 0.8, o: 0.8, d: 0.8, s: 0.8 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.playerProfile).toEqual([]);
        });

        // Pull-factor tests — provisional players excluded from threshold calculation
        it('pull factor: 0 season ELO games → pull=0, excluded from threshold pool, no trait', () => {
            // Alice is provisional (sg=0): pull=0, not in threshold pool
            // Bob is established (sg=35): pull=0.8, mean=0.8, threshold=0.9
            // Alice pull (0) < 0.9 → no trait
            const r = buildWithNorms({ Alice: { g: 1.0, sg: 0 }, Bob: { g: 0.8, sg: 35 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isFinisher).toBe(false);
            expect(r.players.Alice.traits.isAttacker).toBe(false);
            expect(r.players.Alice.traits.isDefender).toBe(false);
            expect(r.players.Alice.traits.isShotStopper).toBe(false);
            expect(r.players.Alice.playerProfile).toEqual([]);
        });

        it('pull factor: 7 season ELO games → aggressively suppressed by quadratic pull', () => {
            // Alice sg=7: pull = 1.0 * (7/35)^2 = 0.04
            // Bob sg=35: pull = 0.8 → only Bob in threshold pool → mean=0.8, threshold=0.9
            // Alice pull (0.04) < 0.9 → no trait
            const r = buildWithNorms({ Alice: { g: 1.0, sg: 7 }, Bob: { g: 0.8, sg: 35 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isFinisher).toBe(false);
        });

        it('pull factor: 35 season ELO games → full confidence, uses dynamic threshold', () => {
            // Alice: g=0.8, sg=35 → pull=0.8; Bob: g=0.2, sg=35 → pull=0.2
            // mean=0.5, threshold=0.6 → Alice (0.8) passes
            const r = buildWithNorms({ Alice: { g: 0.8, sg: 35 }, Bob: { g: 0.2, sg: 35 } });
            rankingsManager.calculatePlayerProfiles(r);
            expect(r.players.Alice.traits.isFinisher).toBe(true);
        });
    });
});
