import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayerManager } from '$lib/server/playerManager.js';
import { data } from '$lib/server/data.js';

// Mock the data service
vi.mock('$lib/server/data.js', () => ({
    data: {
        get: vi.fn(),
        setMany: vi.fn()
    }
}));

// Mock settings service
vi.mock('$lib/server/settings.js', () => ({
    getConsolidatedSettings: vi.fn()
}));

describe('PlayerManager Caching', () => {
    let mockGet;
    let mockSetMany;
    let mockGetConsolidatedSettings;

    beforeEach(async () => {
        // Import the mocked modules
        const { data } = await import('$lib/server/data.js');
        const { getConsolidatedSettings } = await import('$lib/server/settings.js');
        
        mockGet = data.get;
        mockSetMany = data.setMany;
        mockGetConsolidatedSettings = getConsolidatedSettings;

        // Reset all mocks
        vi.clearAllMocks();

        // Setup default mock responses
        mockGet.mockImplementation((key) => {
            if (key === 'players') {
                return Promise.resolve({ available: ['John', 'Jane'], waitingList: [] });
            }
            if (key === 'teams') {
                return Promise.resolve({ A: ['John'], B: ['Jane'] });
            }
            return Promise.resolve(null);
        });

        mockGetConsolidatedSettings.mockResolvedValue({
            playerLimit: 20,
            teamsCount: 2
        });

        mockSetMany.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('cache hit behavior', () => {
        it('should load data from disk on first getData() call', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            await manager.getData();

            // Should call data.get for each data type
            expect(mockGet).toHaveBeenCalledTimes(2); // players, teams
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);
        });

        it('should use cache on subsequent getData() calls', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // First call loads from disk
            const data1 = await manager.getData();
            
            // Second call should use cache
            const data2 = await manager.getData();

            // Should only call data.get once (during first call)
            expect(mockGet).toHaveBeenCalledTimes(2); // players, teams
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);

            // Data should be identical
            expect(data1).toEqual(data2);
        });

        it('should return deep clones from cache to prevent mutation', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            const data1 = await manager.getData();
            const data2 = await manager.getData();

            // Modify first result
            data1.players.available.push('Modified');

            // Second result should be unaffected
            expect(data2.players.available).not.toContain('Modified');
            expect(data2.players.available).toEqual(['John', 'Jane']);
        });
    });

    describe('cache invalidation', () => {
        it('should invalidate cache when date changes', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // First call
            await manager.getData();
            expect(mockGet).toHaveBeenCalledTimes(2);

            // Change date and call again
            manager.setDate('2024-01-16');
            await manager.getData();

            // Should have loaded data again
            expect(mockGet).toHaveBeenCalledTimes(4); // 2 + 2 from second load
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(2);
        });

        it('should invalidate cache when league changes', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // First call
            await manager.getData();
            expect(mockGet).toHaveBeenCalledTimes(2);

            // Change league and call again
            manager.setLeague('other-league');
            await manager.getData();

            // Should have loaded data again
            expect(mockGet).toHaveBeenCalledTimes(4); // 2 + 2 from second load
        });

        it('should not invalidate cache when setting same date/league', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // First call
            await manager.getData();
            expect(mockGet).toHaveBeenCalledTimes(2);

            // Set same date and league
            manager.setDate('2024-01-15').setLeague('test-league');
            await manager.getData();

            // Should still use cache
            expect(mockGet).toHaveBeenCalledTimes(2); // No additional calls
        });

        it('should invalidate cache after successful transaction', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // Load initial data (this will be cached)
            await manager.getData();
            expect(mockGet).toHaveBeenCalledTimes(2);

            // Execute a transaction that modifies data
            await manager.addPlayer('NewPlayer');

            // Next getData call should reload from disk because cache was invalidated
            await manager.getData();

            // Should have called data.get again after the transaction
            expect(mockGet).toHaveBeenCalledTimes(4); // Initial 2 calls + 2 more after cache invalidation
        });

        it('should not invalidate cache if transaction fails', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // Load initial data
            await manager.getData();
            expect(mockGet).toHaveBeenCalledTimes(2);

            // Make setMany fail
            mockSetMany.mockRejectedValueOnce(new Error('Save failed'));

            // Try to execute a transaction (should fail)
            await expect(manager.addPlayer('NewPlayer')).rejects.toThrow();

            // Next getData call should still use cache since transaction failed
            await manager.getData();

            // Should not have made additional data.get calls
            expect(mockGet).toHaveBeenCalledTimes(2);
        });
    });

    describe('cache key generation', () => {
        it('should generate different cache keys for different date-league combinations', async () => {
            const manager1 = createPlayerManager().setDate('2024-01-15').setLeague('league1');
            const manager2 = createPlayerManager().setDate('2024-01-16').setLeague('league1');
            const manager3 = createPlayerManager().setDate('2024-01-15').setLeague('league2');

            // Each should load data independently
            await manager1.getData();
            await manager2.getData();
            await manager3.getData();

            // Should have made 3 separate sets of calls (2 data.get calls per manager)
            expect(mockGet).toHaveBeenCalledTimes(6);
        });
    });

    describe('performance optimization', () => {
        it('should reduce disk I/O for multiple operations on same data', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // Simulate multiple operations that would normally reload data
            await manager.getData();
            await manager.getData();
            await manager.getData();

            // Should only load data once
            expect(mockGet).toHaveBeenCalledTimes(2); // players, teams
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);
        });
    });
});