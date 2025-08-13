import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDisciplineManager } from '$lib/server/discipline.js';
import { createRankingsManager } from '$lib/server/rankings.js';
import fs from 'fs/promises';
import path from 'path';

describe('Discipline Integration', () => {
    const testLeagueId = 'test-discipline-integration';
    const testDataPath = path.join(process.cwd(), 'data', testLeagueId);

    beforeEach(async () => {
        // Create the test data directory
        await fs.mkdir(testDataPath, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test files
        try {
            await fs.rm(testDataPath, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should clear active no-shows when rankings are updated and players appear', async () => {
        const disciplineManager = createDisciplineManager().setLeague(testLeagueId);
        const rankingsManager = createRankingsManager().setLeague(testLeagueId);

        // Record some no-shows for a player
        await disciplineManager.recordNoShow('TestPlayer', '2025-01-13');
        await disciplineManager.recordNoShow('TestPlayer', '2025-01-14');

        // Verify the player has active no-shows
        let record = await disciplineManager.getPlayerRecord('TestPlayer');
        expect(record.activeNoShows).toEqual(['2025-01-13', '2025-01-14']);
        expect(record.clearedNoShows).toEqual([]);

        // Create a session where the player appeared
        const sessionData = {
            players: {
                TestPlayer: {
                    status: 'available',
                    registrationTime: '2025-01-15T10:00:00.000Z'
                }
            },
            teams: {
                'Team A': ['TestPlayer', 'Player2', 'Player3', 'Player4', 'Player5'],
                'Team B': ['Player6', 'Player7', 'Player8', 'Player9', 'Player10']
            },
            games: {
                rounds: [
                    [
                        {
                            home: 'Team A',
                            away: 'Team B',
                            homeScore: 3,
                            awayScore: 1
                        }
                    ]
                ]
            },
            settings: {
                registrationEnd: '2025-01-15T09:00:00.000Z'
            }
        };

        // Save session data
        const sessionPath = path.join(testDataPath, '2025-01-15.json');
        await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));

        // Update rankings - this should trigger the discipline clearing logic
        await rankingsManager.updateRankings();

        // Verify player's active no-shows were cleared
        record = await disciplineManager.getPlayerRecord('TestPlayer');
        expect(record.activeNoShows).toEqual([]);
        expect(record.clearedNoShows).toHaveLength(2);
        expect(record.clearedNoShows[0].date).toBe('2025-01-13');
        expect(record.clearedNoShows[0].clearedOn).toBe('2025-01-15');
        expect(record.clearedNoShows[1].date).toBe('2025-01-14');
        expect(record.clearedNoShows[1].clearedOn).toBe('2025-01-15');
    });

    it('should not clear no-shows if player does not appear in session', async () => {
        const disciplineManager = createDisciplineManager().setLeague(testLeagueId);
        const rankingsManager = createRankingsManager().setLeague(testLeagueId);

        // Record some no-shows for a player
        await disciplineManager.recordNoShow('TestPlayer', '2025-01-13');
        await disciplineManager.recordNoShow('TestPlayer', '2025-01-14');

        // Create a session where the player did NOT appear
        const sessionData = {
            players: {
                OtherPlayer: {
                    status: 'available',
                    registrationTime: '2025-01-15T10:00:00.000Z'
                }
            },
            teams: {
                'Team A': ['OtherPlayer', 'Player2', 'Player3', 'Player4', 'Player5'],
                'Team B': ['Player6', 'Player7', 'Player8', 'Player9', 'Player10']
            },
            games: {
                rounds: [
                    [
                        {
                            home: 'Team A',
                            away: 'Team B',
                            homeScore: 3,
                            awayScore: 1
                        }
                    ]
                ]
            },
            settings: {
                registrationEnd: '2025-01-15T09:00:00.000Z'
            }
        };

        // Save session data
        const sessionPath = path.join(testDataPath, '2025-01-15.json');
        await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));

        // Update rankings
        await rankingsManager.updateRankings();

        // Verify the player still has active no-shows
        const record = await disciplineManager.getPlayerRecord('TestPlayer');
        expect(record.activeNoShows).toEqual(['2025-01-13', '2025-01-14']);
        expect(record.clearedNoShows).toEqual([]);
    });
});
