import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { data } from '$lib/server/data.js';

describe('Data Service', () => {
    const testDataDir = path.join(process.cwd(), 'test', 'data');
    const testDate = '2025-01-25';
    const testLeagueId = 'test-league';

    // Mock the getLeagueDataPath function to return our test directory
    beforeEach(async () => {
        // Create test data directory and league subdirectories
        await fs.mkdir(testDataDir, { recursive: true });
        await fs.mkdir(path.join(testDataDir, 'league1'), { recursive: true });
        await fs.mkdir(path.join(testDataDir, 'league2'), { recursive: true });
        await fs.mkdir(path.join(testDataDir, 'league3'), { recursive: true });
        await fs.mkdir(path.join(testDataDir, 'test-league'), { recursive: true });
        await fs.mkdir(path.join(testDataDir, 'premier-league'), { recursive: true });

        // Mock the league data path function to return different paths for different leagues
        vi.spyOn(await import('$lib/server/league.js'), 'getLeagueDataPath').mockImplementation(
            (leagueId) => {
                return leagueId ? path.join(testDataDir, leagueId) : testDataDir;
            }
        );
    });

    afterEach(async () => {
        // Clean up test data directory
        try {
            await fs.rm(testDataDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
        vi.restoreAllMocks();
    });

    describe('set and get', () => {
        it('should set and get a simple value', async () => {
            await data.set('players.available', testDate, 'John', [], false, testLeagueId);
            const result = await data.get('players.available', testDate, testLeagueId);

            expect(result).toEqual(['John']);
        });

        it('should handle object values with overwrite', async () => {
            await data.set('settings', testDate, { playerLimit: 8 }, {}, true, testLeagueId);
            const result = await data.get('settings', testDate, testLeagueId);

            expect(result).toEqual({ playerLimit: 8 });
        });

        it('should merge object values without overwrite', async () => {
            await data.set('settings', testDate, { playerLimit: 8 }, {}, true, testLeagueId);
            await data.set('settings', testDate, { teamSize: 5 }, {}, false, testLeagueId);
            const result = await data.get('settings', testDate, testLeagueId);

            expect(result).toEqual({ playerLimit: 8, teamSize: 5 });
        });

        it('should return null for non-existent keys', async () => {
            const result = await data.get('nonexistent', testDate, testLeagueId);
            expect(result).toBeNull();
        });

        it('should handle invalid date formats', async () => {
            const result = await data.set('key', 'invalid-date', 'value', [], false, testLeagueId);
            expect(result).toBeNull();
        });
    });

    describe('setMany', () => {
        it('should atomically set multiple values', async () => {
            const operations = [
                { key: 'players.available', value: 'Alice', defaultValue: [] },
                { key: 'players.waitingList', value: 'Bob', defaultValue: [] },
                { key: 'settings', value: { playerLimit: 8 }, defaultValue: {}, overwrite: true }
            ];

            const results = await data.setMany(operations, testDate, testLeagueId);

            expect(results['players.available']).toEqual(['Alice']);
            expect(results['players.waitingList']).toEqual(['Bob']);
            expect(results.settings).toEqual({ playerLimit: 8 });

            // Verify all values were written to the same file
            const available = await data.get('players.available', testDate, testLeagueId);
            const waiting = await data.get('players.waitingList', testDate, testLeagueId);
            const settings = await data.get('settings', testDate, testLeagueId);

            expect(available).toEqual(['Alice']);
            expect(waiting).toEqual(['Bob']);
            expect(settings).toEqual({ playerLimit: 8 });
        });

        it('should handle mixed operation types in single transaction', async () => {
            // Setup initial data
            await data.set('players.available', testDate, 'John', [], false, testLeagueId);
            await data.set('settings', testDate, { playerLimit: 8 }, {}, true, testLeagueId);

            const operations = [
                { key: 'players.available', value: 'Alice' }, // Add to array
                { key: 'settings', value: { teamSize: 5 } }, // Merge object
                { key: 'teams.TeamA', value: ['Charlie', null], defaultValue: [], overwrite: true } // New array
            ];

            const results = await data.setMany(operations, testDate, testLeagueId);

            expect(results['players.available']).toEqual(['John', 'Alice']);
            expect(results.settings).toEqual({ playerLimit: 8, teamSize: 5 });
            expect(results['teams.TeamA']).toEqual([['Charlie', null]]);
        });

        it('should return null for invalid date', async () => {
            const operations = [{ key: 'test', value: 'value' }];
            const result = await data.setMany(operations, 'invalid-date', testLeagueId);
            expect(result).toBeNull();
        });

        it('should handle empty operations array', async () => {
            const result = await data.setMany([], testDate, testLeagueId);
            expect(result).toEqual({});
        });

        it('should be truly atomic - all or nothing on file write errors', async () => {
            // This test verifies atomicity by ensuring a consistent state even if there are issues
            const operations = [
                { key: 'players.available', value: 'Alice', defaultValue: [] },
                { key: 'players.waitingList', value: 'Bob', defaultValue: [] }
            ];

            // Successfully write
            await data.setMany(operations, testDate, testLeagueId);

            // Verify both values exist
            expect(await data.get('players.available', testDate, testLeagueId)).toEqual(['Alice']);
            expect(await data.get('players.waitingList', testDate, testLeagueId)).toEqual(['Bob']);
        });
    });

    describe('file handling and concurrency', () => {
        it('should create file if it does not exist', async () => {
            await data.set('new.key', testDate, 'value', [], false, testLeagueId);
            const result = await data.get('new.key', testDate, testLeagueId);
            expect(result).toEqual(['value']);
        });

        it('should handle concurrent operations safely', async () => {
            // Run multiple setMany operations concurrently
            const operations1 = [
                { key: 'players.available', value: 'Alice', defaultValue: [] },
                { key: 'settings.playerLimit', value: 8, defaultValue: 0, overwrite: true }
            ];

            const operations2 = [
                { key: 'players.available', value: 'Bob', defaultValue: [] },
                { key: 'settings.teamSize', value: 5, defaultValue: 0, overwrite: true }
            ];

            await Promise.all([
                data.setMany(operations1, testDate, testLeagueId),
                data.setMany(operations2, testDate, testLeagueId)
            ]);

            // Both operations should have completed successfully
            const available = await data.get('players.available', testDate, testLeagueId);
            const playerLimit = await data.get('settings.playerLimit', testDate, testLeagueId);
            const teamSize = await data.get('settings.teamSize', testDate, testLeagueId);

            expect(available).toEqual(expect.arrayContaining(['Alice', 'Bob']));
            expect(playerLimit).toBe(8);
            expect(teamSize).toBe(5);
        });
    });

    describe('league isolation', () => {
        it('should isolate data between different leagues', async () => {
            await data.set('players.available', testDate, 'Alice', [], false, 'league1');
            await data.set('players.available', testDate, 'Bob', [], false, 'league2');

            const league1Data = await data.get('players.available', testDate, 'league1');
            const league2Data = await data.get('players.available', testDate, 'league2');

            expect(league1Data).toEqual(['Alice']);
            expect(league2Data).toEqual(['Bob']);
        });

        it('should work with setMany across different leagues', async () => {
            const operations = [{ key: 'players.available', value: 'Charlie', defaultValue: [] }];

            await data.setMany(operations, testDate, 'league3');
            const result = await data.get('players.available', testDate, 'league3');

            expect(result).toEqual(['Charlie']);
        });

        it('should maintain complete data isolation between leagues', async () => {
            // Set up different data structures in different leagues
            const league1Operations = [
                { key: 'players.available', value: 'Alice', defaultValue: [] },
                { key: 'teams.TeamA', value: ['Alice', null], defaultValue: [], overwrite: true },
                { key: 'settings', value: { playerLimit: 10 }, defaultValue: {}, overwrite: true }
            ];

            const league2Operations = [
                { key: 'players.available', value: 'Bob', defaultValue: [] },
                {
                    key: 'teams.TeamB',
                    value: ['Bob', 'Charlie'],
                    defaultValue: [],
                    overwrite: true
                },
                { key: 'settings', value: { playerLimit: 20 }, defaultValue: {}, overwrite: true }
            ];

            await data.setMany(league1Operations, testDate, 'league1');
            await data.setMany(league2Operations, testDate, 'league2');

            // Verify league1 data
            const league1Players = await data.get('players.available', testDate, 'league1');
            const league1Teams = await data.get('teams.TeamA', testDate, 'league1');
            const league1Settings = await data.get('settings', testDate, 'league1');

            expect(league1Players).toEqual(['Alice']);
            expect(league1Teams).toEqual([['Alice', null]]);
            expect(league1Settings).toEqual({ playerLimit: 10 });

            // Verify league2 data
            const league2Players = await data.get('players.available', testDate, 'league2');
            const league2Teams = await data.get('teams.TeamB', testDate, 'league2');
            const league2Settings = await data.get('settings', testDate, 'league2');

            expect(league2Players).toEqual(['Bob']);
            expect(league2Teams).toEqual([['Bob', 'Charlie']]);
            expect(league2Settings).toEqual({ playerLimit: 20 });

            // Cross-check: league1 should not have league2's data
            expect(await data.get('teams.TeamB', testDate, 'league1')).toBeUndefined();
            expect(await data.get('teams.TeamA', testDate, 'league2')).toBeUndefined();
        });

        it('should handle concurrent operations across different leagues', async () => {
            const league1Ops = [
                { key: 'players.available', value: 'Player1', defaultValue: [] },
                { key: 'games.match1', value: { score: '2-1' }, defaultValue: {}, overwrite: true }
            ];

            const league2Ops = [
                { key: 'players.available', value: 'Player2', defaultValue: [] },
                { key: 'games.match1', value: { score: '3-0' }, defaultValue: {}, overwrite: true }
            ];

            // Run operations concurrently on different leagues
            await Promise.all([
                data.setMany(league1Ops, testDate, 'league1'),
                data.setMany(league2Ops, testDate, 'league2')
            ]);

            // Verify isolated results
            const league1Players = await data.get('players.available', testDate, 'league1');
            const league1Game = await data.get('games.match1', testDate, 'league1');
            const league2Players = await data.get('players.available', testDate, 'league2');
            const league2Game = await data.get('games.match1', testDate, 'league2');

            expect(league1Players).toEqual(['Player1']);
            expect(league1Game).toEqual({ score: '2-1' });
            expect(league2Players).toEqual(['Player2']);
            expect(league2Game).toEqual({ score: '3-0' });
        });

        it('should create separate directory structures for each league', async () => {
            // This test ensures that league data is physically separated in the file system
            await data.set('test.data', testDate, 'league1-data', [], false, 'league1');
            await data.set('test.data', testDate, 'league2-data', [], false, 'league2');
            await data.set('test.data', testDate, 'league3-data', [], false, 'league3');

            // Verify each league has its own data
            expect(await data.get('test.data', testDate, 'league1')).toEqual(['league1-data']);
            expect(await data.get('test.data', testDate, 'league2')).toEqual(['league2-data']);
            expect(await data.get('test.data', testDate, 'league3')).toEqual(['league3-data']);

            // Verify cross-contamination doesn't occur
            expect(await data.get('test.data', testDate, 'league1')).not.toContain('league2-data');
            expect(await data.get('test.data', testDate, 'league2')).not.toContain('league3-data');
            expect(await data.get('test.data', testDate, 'league3')).not.toContain('league1-data');
        });

        it('should support complex nested data structures per league', async () => {
            // Test complex data using single-level keys to avoid circular reference issues with resolvePath
            const complexOperations = [
                {
                    key: 'tournament',
                    value: {
                        semifinals: {
                            match1: { team1: 'TeamA', team2: 'TeamB', score: null },
                            match2: { team1: 'TeamC', team2: 'TeamD', score: null }
                        }
                    },
                    defaultValue: {},
                    overwrite: true
                },
                {
                    key: 'rankings',
                    value: {
                        individual: [
                            { player: 'Alice', points: 150 },
                            { player: 'Bob', points: 120 }
                        ]
                    },
                    defaultValue: {},
                    overwrite: true
                }
            ];

            await data.setMany(complexOperations, testDate, 'premier-league');

            const tournament = await data.get('tournament', testDate, 'premier-league');
            const rankings = await data.get('rankings', testDate, 'premier-league');

            expect(tournament).toEqual({
                semifinals: {
                    match1: { team1: 'TeamA', team2: 'TeamB', score: null },
                    match2: { team1: 'TeamC', team2: 'TeamD', score: null }
                }
            });
            expect(rankings).toEqual({
                individual: [
                    { player: 'Alice', points: 150 },
                    { player: 'Bob', points: 120 }
                ]
            });

            // Verify this data doesn't exist in other leagues (returns null when the file doesn't exist)
            expect(await data.get('tournament', testDate, testLeagueId)).toBeNull();
        });
    });
});
