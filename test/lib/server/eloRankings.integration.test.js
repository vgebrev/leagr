import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEloRankingsManager } from '$lib/server/eloRankings.js';
import fs from 'fs/promises';
import path from 'path';

const TEST_LEAGUE_ID = 'test-elo-league';
const TEST_DATA_DIR = path.join(process.cwd(), 'test', 'data', TEST_LEAGUE_ID);

describe('EloRankingsManager - Integration Tests', () => {
    let eloManager;

    beforeEach(async () => {
        eloManager = createEloRankingsManager().setLeague(TEST_LEAGUE_ID);

        // Ensure test directory exists
        try {
            await fs.mkdir(TEST_DATA_DIR, { recursive: true });
        } catch {
            // Directory might already exist
        }

        // Mock league data path
        vi.mock('$lib/server/league.js', () => ({
            getLeagueDataPath: vi.fn(() => TEST_DATA_DIR)
        }));
    });

    afterEach(async () => {
        // Clean up test files
        try {
            await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should process a complete session and update rankings', async () => {
        // Create a test session file
        const sessionData = {
            teams: {
                'Red Team': ['Alice', 'Bob'],
                'Blue Team': ['Charlie', 'David'],
                'Green Team': ['Eve', 'Frank'],
                'Yellow Team': ['Grace', 'Henry']
            },
            games: {
                rounds: [
                    [
                        {
                            home: 'Red Team',
                            away: 'Blue Team',
                            homeScore: 2,
                            awayScore: 1
                        },
                        {
                            home: 'Green Team',
                            away: 'Yellow Team',
                            homeScore: 1,
                            awayScore: 1
                        }
                    ],
                    [
                        {
                            home: 'Red Team',
                            away: 'Green Team',
                            homeScore: 0,
                            awayScore: 2
                        }
                    ]
                ]
            }
        };

        const sessionDate = '2025-01-15';
        const sessionPath = path.join(TEST_DATA_DIR, `${sessionDate}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));

        // Process the session
        const rankings = await eloManager.processSession(sessionDate);

        // Verify players were created and have ratings
        expect(rankings.players['Alice']).toBeDefined();
        expect(rankings.players['Bob']).toBeDefined();
        expect(rankings.players['Charlie']).toBeDefined();
        expect(rankings.players['David']).toBeDefined();
        expect(rankings.players['Eve']).toBeDefined();
        expect(rankings.players['Frank']).toBeDefined();
        expect(rankings.players['Grace']).toBeDefined();
        expect(rankings.players['Henry']).toBeDefined();

        // Verify all players have ratings
        Object.values(rankings.players).forEach((player) => {
            expect(player.rating).toBeTypeOf('number');
            expect(player.gamesPlayed).toBeGreaterThan(0);
            expect(player.sessionsPlayed).toBe(1);
            expect(player.lastPlayedAt).toBe(sessionDate);
        });

        // Verify session was marked as processed
        expect(rankings.processedSessions).toContain(sessionDate);
        expect(rankings.lastUpdated).toBe(sessionDate);
    });

    it('should handle idempotent processing', async () => {
        // Create a test session file
        const sessionData = {
            teams: {
                'Team A': ['Player1'],
                'Team B': ['Player2']
            },
            games: {
                rounds: [
                    [
                        {
                            home: 'Team A',
                            away: 'Team B',
                            homeScore: 1,
                            awayScore: 0
                        }
                    ]
                ]
            }
        };

        const sessionDate = '2025-01-16';
        const sessionPath = path.join(TEST_DATA_DIR, `${sessionDate}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));

        // Process the session twice
        const firstResult = await eloManager.processSession(sessionDate);
        const secondResult = await eloManager.processSession(sessionDate);

        // Results should be identical
        expect(secondResult).toEqual(firstResult);
        expect(secondResult.processedSessions.filter((d) => d === sessionDate)).toHaveLength(1);
    });

    it('should apply decay correctly over multiple sessions', async () => {
        // Create initial session
        const session1Data = {
            teams: {
                'Team A': ['TestPlayer']
            },
            games: {
                rounds: [
                    [
                        {
                            home: 'Team A',
                            away: 'Team A', // Self-play for simplicity
                            homeScore: 1,
                            awayScore: 1
                        }
                    ]
                ]
            }
        };

        const session1Date = '2025-01-01';
        const session1Path = path.join(TEST_DATA_DIR, `${session1Date}.json`);
        await fs.writeFile(session1Path, JSON.stringify(session1Data, null, 2));

        // Process first session
        await eloManager.processSession(session1Date);
        const afterSession1 = await eloManager.loadEloRankings();
        const initialRating = afterSession1.players['TestPlayer'].rating;

        // Create second session 2 weeks later (should apply decay)
        const session2Date = '2025-01-15'; // 2 weeks later
        const session2Path = path.join(TEST_DATA_DIR, `${session2Date}.json`);
        await fs.writeFile(session2Path, JSON.stringify(session1Data, null, 2));

        // Process second session
        await eloManager.processSession(session2Date);
        const afterSession2 = await eloManager.loadEloRankings();
        const decayedRating = afterSession2.players['TestPlayer'].rating;

        // Rating should have moved toward 1000 due to decay (2 weeks * 2% = 4% decay)
        if (initialRating > 1000) {
            expect(decayedRating).toBeLessThan(initialRating);
        } else if (initialRating < 1000) {
            expect(decayedRating).toBeGreaterThan(initialRating);
        }
    });

    it('should skip sessions without completed games', async () => {
        // Create a session with no scores
        const sessionData = {
            teams: {
                'Team A': ['Player1'],
                'Team B': ['Player2']
            },
            games: {
                rounds: [
                    [
                        {
                            home: 'Team A',
                            away: 'Team B',
                            homeScore: null,
                            awayScore: null
                        }
                    ]
                ]
            }
        };

        const sessionDate = '2025-01-17';
        const sessionPath = path.join(TEST_DATA_DIR, `${sessionDate}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));

        // Process the session
        const rankings = await eloManager.processSession(sessionDate);

        // Should not create any players or process the session
        expect(Object.keys(rankings.players)).toHaveLength(0);
        expect(rankings.processedSessions).not.toContain(sessionDate);
    });
});
