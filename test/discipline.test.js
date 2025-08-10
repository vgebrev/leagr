import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDisciplineManager, DisciplineError } from '$lib/server/discipline.js';
import fs from 'fs/promises';
import path from 'path';

describe('DisciplineManager', () => {
    const testLeagueId = 'test-league';
    const testDataPath = path.join(process.cwd(), 'data', testLeagueId);
    const disciplinePath = path.join(testDataPath, 'discipline.json');
    let disciplineManager;

    beforeEach(async () => {
        // Create test data directory
        await fs.mkdir(testDataPath, { recursive: true });
        disciplineManager = createDisciplineManager().setLeague(testLeagueId);
    });

    afterEach(async () => {
        // Clean up test files
        try {
            await fs.rm(testDataPath, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Factory and Initialization', () => {
        it('should create a discipline manager instance', () => {
            const manager = createDisciplineManager();
            expect(manager).toBeDefined();
        });

        it('should require league ID to be set', () => {
            const manager = createDisciplineManager();
            expect(() => manager.getDataPath()).toThrow('League ID must be set');
        });

        it('should allow fluent interface with setLeague', () => {
            const manager = createDisciplineManager().setLeague(testLeagueId);
            expect(manager.leagueId).toBe(testLeagueId);
        });

        it('should throw error if league ID is not provided to setLeague', () => {
            const manager = createDisciplineManager();
            expect(() => manager.setLeague(null)).toThrow(DisciplineError);
        });
    });

    describe('File Operations', () => {
        it('should return default data structure when file does not exist', async () => {
            const data = await disciplineManager.loadDisciplineData();
            expect(data).toEqual({
                lastUpdated: null,
                players: {}
            });
        });

        it('should create and save discipline data', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');

            // Verify file was created
            const fileExists = await fs
                .access(disciplinePath)
                .then(() => true)
                .catch(() => false);
            expect(fileExists).toBe(true);

            // Verify file content
            const content = JSON.parse(await fs.readFile(disciplinePath, 'utf-8'));
            expect(content.players.TestPlayer.noShows).toBe(1);
            expect(content.lastUpdated).toBeDefined();
        });
    });

    describe('Player Record Management', () => {
        it('should return default player record for new player', async () => {
            const record = await disciplineManager.getPlayerRecord('NewPlayer');
            expect(record).toEqual({
                noShows: 0,
                suspensions: [],
                totalSuspensions: 0
            });
        });

        it('should increment no-show count for player', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');
            const record = await disciplineManager.getPlayerRecord('TestPlayer');
            expect(record.noShows).toBe(1);
        });

        it('should handle multiple no-shows for same player', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');
            await disciplineManager.incrementNoShow('TestPlayer');
            const record = await disciplineManager.getPlayerRecord('TestPlayer');
            expect(record.noShows).toBe(2);
        });
    });

    describe('Suspension Logic', () => {
        const mockSettings = {
            discipline: {
                enabled: true,
                noShowThreshold: 2
            }
        };

        it('should not suspend if discipline system is disabled', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');
            await disciplineManager.incrementNoShow('TestPlayer');

            const disabledSettings = { discipline: { enabled: false } };
            const result = await disciplineManager.shouldSuspend('TestPlayer', disabledSettings);
            expect(result.shouldSuspend).toBe(false);
            expect(result.reason).toBe('Discipline system disabled');
        });

        it('should not suspend if below threshold', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');

            const result = await disciplineManager.shouldSuspend('TestPlayer', mockSettings);
            expect(result.shouldSuspend).toBe(false);
            expect(result.reason).toBe('Below no-show threshold');
        });

        it('should suspend if at threshold', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');
            await disciplineManager.incrementNoShow('TestPlayer');

            const result = await disciplineManager.shouldSuspend('TestPlayer', mockSettings);
            expect(result.shouldSuspend).toBe(true);
            expect(result.reason).toContain('Player has 2 no-shows (threshold: 2)');
        });

        it('should use default threshold if not specified in settings', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');
            await disciplineManager.incrementNoShow('TestPlayer');

            const emptySettings = { discipline: { enabled: true } };
            const result = await disciplineManager.shouldSuspend('TestPlayer', emptySettings);
            expect(result.shouldSuspend).toBe(true);
        });
    });

    describe('Suspension Application', () => {
        it('should apply suspension and reset no-show count', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');
            await disciplineManager.incrementNoShow('TestPlayer');

            const sessionDate = '2025-01-15';
            await disciplineManager.applySuspension('TestPlayer', sessionDate);

            const record = await disciplineManager.getPlayerRecord('TestPlayer');
            expect(record.noShows).toBe(0); // Reset after suspension
            expect(record.totalSuspensions).toBe(1);
            expect(record.suspensions).toHaveLength(1);
            expect(record.suspensions[0].date).toBe(sessionDate);
            expect(record.suspensions[0].reason).toBe('Repeated no-shows');
        });

        it('should apply suspension with custom reason', async () => {
            const sessionDate = '2025-01-15';
            const customReason = 'Custom suspension reason';

            await disciplineManager.applySuspension('TestPlayer', sessionDate, customReason);

            const record = await disciplineManager.getPlayerRecord('TestPlayer');
            expect(record.suspensions[0].reason).toBe(customReason);
        });
    });

    describe('Suspension Checking', () => {
        it('should return not suspended for player without suspensions', async () => {
            const result = await disciplineManager.isPlayerSuspended('TestPlayer', '2025-01-15');
            expect(result.suspended).toBe(false);
        });

        it('should return suspended for player with suspension on specific date', async () => {
            const sessionDate = '2025-01-15';
            await disciplineManager.applySuspension('TestPlayer', sessionDate, 'Test suspension');

            const result = await disciplineManager.isPlayerSuspended('TestPlayer', sessionDate);
            expect(result.suspended).toBe(true);
            expect(result.reason).toContain('Test suspension');
            expect(result.suspension).toBeDefined();
        });

        it('should return not suspended for player with suspension on different date', async () => {
            await disciplineManager.applySuspension('TestPlayer', '2025-01-15', 'Test suspension');

            const result = await disciplineManager.isPlayerSuspended('TestPlayer', '2025-01-16');
            expect(result.suspended).toBe(false);
        });
    });

    describe('Signup Evaluation', () => {
        const mockSettings = {
            discipline: {
                enabled: true,
                noShowThreshold: 2
            }
        };

        it('should allow signup if player has no suspensions or no-shows', async () => {
            const result = await disciplineManager.evaluateSuspensionOnSignup(
                'TestPlayer',
                '2025-01-15',
                mockSettings
            );
            expect(result.suspended).toBe(false);
        });

        it('should block signup if player already suspended for this session', async () => {
            const sessionDate = '2025-01-15';
            await disciplineManager.applySuspension('TestPlayer', sessionDate, 'Already suspended');

            const result = await disciplineManager.evaluateSuspensionOnSignup(
                'TestPlayer',
                sessionDate,
                mockSettings
            );
            expect(result.suspended).toBe(true);
            expect(result.reason).toContain('Already suspended');
        });

        it('should apply new suspension if player reaches no-show threshold', async () => {
            await disciplineManager.incrementNoShow('TestPlayer');
            await disciplineManager.incrementNoShow('TestPlayer');

            const sessionDate = '2025-01-15';
            const result = await disciplineManager.evaluateSuspensionOnSignup(
                'TestPlayer',
                sessionDate,
                mockSettings
            );

            expect(result.suspended).toBe(true);
            expect(result.newSuspension).toBe(true);
            expect(result.reason).toContain(
                'You have been suspended for this session due to repeated no-shows'
            );

            // Verify suspension was actually applied
            const record = await disciplineManager.getPlayerRecord('TestPlayer');
            expect(record.noShows).toBe(0); // Reset after suspension
            expect(record.totalSuspensions).toBe(1);
        });
    });

    describe('Suspension Readiness', () => {
        it('should log when player is ready for suspension', async () => {
            const mockSettings = {
                discipline: {
                    enabled: true,
                    noShowThreshold: 2
                }
            };

            await disciplineManager.incrementNoShow('TestPlayer');
            await disciplineManager.incrementNoShow('TestPlayer');

            // Capture console.warn output
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await disciplineManager.updateSuspensionReadinessIfNeeded('TestPlayer', mockSettings);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Player TestPlayer is ready for suspension')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Data Retrieval', () => {
        it('should return all discipline records', async () => {
            await disciplineManager.incrementNoShow('Player1');
            await disciplineManager.incrementNoShow('Player2');
            await disciplineManager.applySuspension('Player1', '2025-01-15');

            const allRecords = await disciplineManager.getAllRecords();

            expect(allRecords.players.Player1).toBeDefined();
            expect(allRecords.players.Player2).toBeDefined();
            expect(allRecords.players.Player1.totalSuspensions).toBe(1);
            expect(allRecords.players.Player2.noShows).toBe(1);
        });
    });

    describe('Concurrency Safety', () => {
        it('should handle concurrent no-show increments safely', async () => {
            const promises = Array(5)
                .fill(null)
                .map(() => disciplineManager.incrementNoShow('TestPlayer'));

            await Promise.all(promises);

            const record = await disciplineManager.getPlayerRecord('TestPlayer');
            expect(record.noShows).toBe(5);
        });
    });
});
