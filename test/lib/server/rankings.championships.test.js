import { describe, it, expect, beforeEach } from 'vitest';
import { RankingsManager } from '$lib/server/rankings.js';

describe('RankingsManager - Championships', () => {
    let rankingsManager;

    beforeEach(() => {
        rankingsManager = new RankingsManager();
        rankingsManager.setLeague('test-league');
    });

    describe('getLeagueWinner', () => {
        it('should return first team from standings', () => {
            const sessionData = {
                teams: {
                    team1: ['Player1', 'Player2'],
                    team2: ['Player3', 'Player4']
                },
                games: {
                    rounds: [[{ home: 'team1', away: 'team2', homeScore: 2, awayScore: 1 }]]
                }
            };

            const winner = rankingsManager.getLeagueWinner(sessionData);
            expect(winner).toBe('team1');
        });

        it('should return null if no games or incomplete games', () => {
            const sessionData = {
                teams: { team1: ['Player1'] },
                games: { rounds: [] }
            };

            const winner = rankingsManager.getLeagueWinner(sessionData);
            expect(winner).toBeNull();
        });
    });

    describe('getCupWinner', () => {
        it('should return winner of final match', () => {
            const sessionData = {
                teams: {
                    team1: ['Player1'],
                    team2: ['Player2']
                },
                games: {
                    'knockout-games': {
                        bracket: [
                            {
                                round: 'final',
                                match: 1,
                                home: 'team1',
                                away: 'team2',
                                homeScore: 2,
                                awayScore: 1
                            }
                        ]
                    }
                }
            };

            const winner = rankingsManager.getCupWinner(sessionData);
            expect(winner).toBe('team1');
        });

        it('should return null if no final or incomplete final', () => {
            const sessionData = {
                teams: { team1: ['Player1'] },
                games: { 'knockout-games': { bracket: [] } }
            };

            const winner = rankingsManager.getCupWinner(sessionData);
            expect(winner).toBeNull();
        });
    });

    describe('addChampionshipFlags', () => {
        it('should add correct championship flags to ranking detail', () => {
            const sessionData = {
                teams: {
                    'winning-team': ['Player1'],
                    'other-team': ['Player2']
                },
                games: {
                    rounds: [
                        [{ home: 'winning-team', away: 'other-team', homeScore: 2, awayScore: 1 }]
                    ],
                    'knockout-games': {
                        bracket: [
                            {
                                round: 'final',
                                match: 1,
                                home: 'winning-team',
                                away: 'other-team',
                                homeScore: 1,
                                awayScore: 0
                            }
                        ]
                    }
                }
            };

            const historyEntry = {
                team: 'winning-team',
                points: { total: 10 },
                performance: {},
                ranking: { rank: 1 }
            };

            const updated = rankingsManager.addChampionshipFlags(historyEntry, sessionData);

            expect(updated.performance.leagueWinner).toBe(true);
            expect(updated.performance.cupWinner).toBe(true);
            expect(updated.points.total).toBe(10); // Preserves existing data
        });

        it('should set false flags for non-winners', () => {
            const sessionData = {
                teams: {
                    'winning-team': ['Player1'],
                    'losing-team': ['Player2']
                },
                games: {
                    rounds: [
                        [{ home: 'winning-team', away: 'losing-team', homeScore: 2, awayScore: 1 }]
                    ],
                    'knockout-games': {
                        bracket: [
                            {
                                round: 'final',
                                match: 1,
                                home: 'winning-team',
                                away: 'losing-team',
                                homeScore: 1,
                                awayScore: 0
                            }
                        ]
                    }
                }
            };

            const historyEntry = {
                team: 'losing-team',
                points: { total: 8 },
                performance: {},
                ranking: { rank: 2 }
            };

            const updated = rankingsManager.addChampionshipFlags(historyEntry, sessionData);

            expect(updated.performance.leagueWinner).toBe(false);
            expect(updated.performance.cupWinner).toBe(false);
        });
    });

    describe('countChampionships', () => {
        it('should count league and cup wins from history', () => {
            const history = {
                '2025-01-01': { performance: { leagueWinner: true, cupWinner: false } },
                '2025-02-01': { performance: { leagueWinner: false, cupWinner: true } },
                '2025-03-01': { performance: { leagueWinner: true, cupWinner: true } },
                '2025-04-01': { performance: { leagueWinner: false, cupWinner: false } }
            };

            const counts = rankingsManager.countChampionships(history);

            expect(counts.leagueWins).toBe(2);
            expect(counts.cupWins).toBe(2);
        });

        it('should return zero for empty history', () => {
            const counts = rankingsManager.countChampionships({});

            expect(counts.leagueWins).toBe(0);
            expect(counts.cupWins).toBe(0);
        });
    });
});
