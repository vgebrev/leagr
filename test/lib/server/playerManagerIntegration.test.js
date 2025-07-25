import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerManager, PlayerError } from '$lib/server/playerManager.js';

// Mock the data module
vi.mock('$lib/server/data.js', () => ({
    data: {
        get: vi.fn(),
        set: vi.fn(),
        setMany: vi.fn()
    }
}));

// Mock the settings module
vi.mock('$lib/server/settings.js', () => ({
    getConsolidatedSettings: vi.fn()
}));

describe('PlayerManager Integration Tests', () => {
    let playerManager;
    let mockData;

    beforeEach(async () => {
        playerManager = new PlayerManager().setDate('2025-01-25').setLeague('test-league');

        const { data } = await import('$lib/server/data.js');

        mockData = data;

        vi.clearAllMocks();
    });

    describe('atomic operations', () => {
        it('should maintain consistency during complex player operations', async () => {
            // Setup initial state
            const initialGameData = {
                players: { available: ['Alice', 'Bob'], waitingList: ['Charlie'] },
                teams: { 'Team A': ['Alice', null], 'Team B': [null, null] },
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(initialGameData);
            mockData.setMany.mockResolvedValue({});

            // Add a new player
            await playerManager.addPlayer('David', 'available');

            // Verify atomic save was called
            expect(mockData.setMany).toHaveBeenCalledWith(
                [
                    {
                        key: 'players',
                        value: expect.objectContaining({
                            available: expect.arrayContaining(['Alice', 'Bob', 'David']),
                            waitingList: ['Charlie']
                        }),
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    }
                ],
                '2025-01-25',
                'test-league'
            );

            // Only players should be updated, not teams
            expect(mockData.setMany).toHaveBeenCalledTimes(1);
        });

        it('should update both players and teams atomically when needed', async () => {
            const initialGameData = {
                players: { available: ['Alice', 'Bob'], waitingList: [] },
                teams: { 'Team A': ['Alice', 'Bob'], 'Team B': [null, null] },
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(initialGameData);
            mockData.setMany.mockResolvedValue({});

            // Remove a player (should update both players and teams)
            await playerManager.removePlayer('Alice', 'available');

            // Verify both players and teams were updated atomically
            expect(mockData.setMany).toHaveBeenCalledTimes(1);

            // Check that both players and teams were updated in a single atomic call
            expect(mockData.setMany).toHaveBeenCalledWith(
                [
                    {
                        key: 'players',
                        value: expect.objectContaining({
                            available: ['Bob'],
                            waitingList: []
                        }),
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    },
                    {
                        key: 'teams',
                        value: expect.objectContaining({
                            'Team A': [null, 'Bob'],
                            'Team B': [null, null]
                        }),
                        defaultValue: {},
                        overwrite: true
                    }
                ],
                '2025-01-25',
                'test-league'
            );
        });

        it('should rollback on validation failure', async () => {
            const corruptedGameData = {
                players: { available: ['Alice'], waitingList: ['Alice'] }, // Duplicate player
                teams: { 'Team A': ['Alice', null] },
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(corruptedGameData);

            // This should fail validation and not save anything
            await expect(playerManager.addPlayer('Bob')).rejects.toThrow(PlayerError);

            // No saves should have been attempted
            expect(mockData.set).not.toHaveBeenCalled();
        });

        it('should handle concurrent operations safely through atomic transactions', async () => {
            const initialGameData = {
                players: { available: ['Alice', 'Bob', 'Charlie'], waitingList: [] },
                teams: { 'Team A': [null, null], 'Team B': [null, null] },
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(initialGameData);
            mockData.setMany.mockResolvedValue({});

            // Each transaction gets fresh data and applies changes atomically
            const manager1 = new PlayerManager().setDate('2025-01-25').setLeague('test-league');
            const manager2 = new PlayerManager().setDate('2025-01-25').setLeague('test-league');

            vi.spyOn(manager1, 'getData').mockResolvedValue(initialGameData);
            vi.spyOn(manager2, 'getData').mockResolvedValue(initialGameData);

            // Both operations should complete successfully
            const [result1, result2] = await Promise.all([
                manager1.fillEmptySlotWithPlayer('Team A', 'Alice'),
                manager2.addPlayer('David', 'available')
            ]);

            // Both operations should have triggered saves
            expect(mockData.setMany).toHaveBeenCalled();

            // Results should be consistent
            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
        });
    });

    describe('state consistency validation', () => {
        it('should prevent inconsistent states from being saved', async () => {
            // Mock a situation where we try to create an inconsistent state
            const badGameData = {
                players: { available: [], waitingList: [] }, // Empty lists
                teams: { 'Team A': ['Ghost', null] }, // But ghost player in team
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(badGameData);

            // Trying to add a player should fail because the initial state is invalid
            await expect(playerManager.addPlayer('Alice')).rejects.toThrow(PlayerError);
            await expect(playerManager.addPlayer('Alice')).rejects.toThrow(
                'Assigned player Ghost not in available list'
            );

            expect(mockData.set).not.toHaveBeenCalled();
        });

        it('should maintain player-team relationship integrity', async () => {
            const gameData = {
                players: { available: ['Alice', 'Bob'], waitingList: ['Charlie'] },
                teams: { 'Team A': ['Alice', null], 'Team B': [null, null] },
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(gameData);
            mockData.setMany.mockResolvedValue({});

            // Move Alice to waiting list - should also remove from team
            await playerManager.movePlayer('Alice', 'available', 'waitingList');

            // Verify atomic update happened
            expect(mockData.setMany).toHaveBeenCalledTimes(1);

            // Alice should be removed from team and moved to waiting list atomically
            expect(mockData.setMany).toHaveBeenCalledWith(
                [
                    {
                        key: 'players',
                        value: expect.objectContaining({
                            available: ['Bob'],
                            waitingList: ['Charlie', 'Alice']
                        }),
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    },
                    {
                        key: 'teams',
                        value: expect.objectContaining({
                            'Team A': [null, null],
                            'Team B': [null, null]
                        }),
                        defaultValue: {},
                        overwrite: true
                    }
                ],
                '2025-01-25',
                'test-league'
            );
        });
    });

    describe('error handling', () => {
        it('should provide clear error messages for business rule violations', async () => {
            const gameData = {
                players: { available: ['Alice', 'Bob', 'Charlie', 'David'], waitingList: [] },
                teams: { 'Team A': [null, null] },
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(gameData);
            mockData.setMany.mockResolvedValue({});

            // When at limit, addPlayer should auto-redirect to waiting list (not throw)
            const result = await playerManager.addPlayer('Eve', 'available');
            expect(result.waitingList).toContain('Eve');
            expect(result.available).not.toContain('Eve');

            // But trying to move from waiting to available when at limit should throw
            gameData.players.waitingList = ['Eve'];
            await expect(
                playerManager.movePlayer('Eve', 'waitingList', 'available')
            ).rejects.toThrow('Player limit of 4 reached');
        });

        it('should handle data layer failures gracefully', async () => {
            const gameData = {
                players: { available: [], waitingList: [] },
                teams: {},
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(gameData);
            mockData.setMany.mockRejectedValue(new Error('Database connection failed'));

            // Should propagate data layer errors
            await expect(playerManager.addPlayer('Alice')).rejects.toThrow(
                'Database connection failed'
            );
        });
    });
});
