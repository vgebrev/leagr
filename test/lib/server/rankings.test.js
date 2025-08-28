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

                // More precise calculation: 1000 + (1200-1000) * (0.98^2)
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
                    rankingDetail: {
                        '2024-01-01': { totalPoints: 5 },
                        '2024-01-08': { totalPoints: 5 }
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

                // Calculate expected rating: 2 weeks from 2024-01-01 to 2024-01-15
                const expectedRating = 1000 + (1200 - 1000) * Math.pow(0.98, 2);
                expect(alice.elo.rating).toBeCloseTo(expectedRating, 2);
            });

            it('should not decay on same date as last decay', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 10,
                    appearances: 1,
                    rankingDetail: {
                        '2024-01-01': { totalPoints: 10 }
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
                    rankingDetail: {},
                    elo: { rating: 1150, gamesPlayed: 5 }
                });

                const playersWhoAppeared = new Set(['Alice']);
                rankingsManager.updateRanksForDate('2024-01-01', playerTracker, playersWhoAppeared);

                const alice = playerTracker.get('Alice');
                expect(alice.rankingDetail['2024-01-01'].eloRating).toBe(1150);
            });

            it('should include ELO rating in ranking detail for non-appearances', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 10,
                    appearances: 1,
                    rankingDetail: {},
                    elo: { rating: 1150, gamesPlayed: 5 }
                });

                const playersWhoAppeared = new Set(); // Alice didn't appear
                rankingsManager.updateRanksForDate('2024-01-02', playerTracker, playersWhoAppeared);

                const alice = playerTracker.get('Alice');
                expect(alice.rankingDetail['2024-01-02'].eloRating).toBe(1150);
                expect(alice.rankingDetail['2024-01-02'].team).toBeNull();
            });

            it('should use baseline rating when no ELO data exists', () => {
                const playerTracker = new Map();
                playerTracker.set('Alice', {
                    points: 0,
                    appearances: 0,
                    rankingDetail: {}
                    // No ELO data
                });

                const playersWhoAppeared = new Set(['Alice']);
                rankingsManager.updateRanksForDate('2024-01-01', playerTracker, playersWhoAppeared);

                const alice = playerTracker.get('Alice');
                expect(alice.rankingDetail['2024-01-01'].eloRating).toBe(1000);
            });
        });

        describe('ELO object in enhanced rankings', () => {
            it('should include ELO object in enhanced player data', () => {
                const rawRankings = {
                    players: {
                        Alice: {
                            points: 10,
                            appearances: 1,
                            rankingDetail: {},
                            elo: {
                                rating: 1150,
                                lastDecayAt: '2024-01-01',
                                gamesPlayed: 5
                            }
                        },
                        Bob: {
                            points: 8,
                            appearances: 1,
                            rankingDetail: {}
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
