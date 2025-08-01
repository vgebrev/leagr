import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayerManager } from '$lib/server/playerManager.js';

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

describe('PlayerManager Lazy Loading', () => {
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

    describe('selective data loading', () => {
        it('should load only players data when requested', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            const result = await manager.getData({ players: true, teams: false, settings: false });

            // Should only call data.get for players
            expect(mockGet).toHaveBeenCalledTimes(1);
            expect(mockGet).toHaveBeenCalledWith('players', '2024-01-15', 'test-league');
            expect(mockGetConsolidatedSettings).not.toHaveBeenCalled();

            // Result should only contain players
            expect(result).toHaveProperty('players');
            expect(result).not.toHaveProperty('teams');
            expect(result).not.toHaveProperty('settings');
        });

        it('should load only teams data when requested', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            const result = await manager.getData({ players: false, teams: true, settings: false });

            // Should only call data.get for teams
            expect(mockGet).toHaveBeenCalledTimes(1);
            expect(mockGet).toHaveBeenCalledWith('teams', '2024-01-15', 'test-league');
            expect(mockGetConsolidatedSettings).not.toHaveBeenCalled();

            // Result should only contain teams
            expect(result).not.toHaveProperty('players');
            expect(result).toHaveProperty('teams');
            expect(result).not.toHaveProperty('settings');
        });

        it('should load only settings data when requested', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            const result = await manager.getData({ players: false, teams: false, settings: true });

            // Should only call getConsolidatedSettings
            expect(mockGet).not.toHaveBeenCalled();
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);
            expect(mockGetConsolidatedSettings).toHaveBeenCalledWith('2024-01-15', 'test-league');

            // Result should only contain settings
            expect(result).not.toHaveProperty('players');
            expect(result).not.toHaveProperty('teams');
            expect(result).toHaveProperty('settings');
        });

        it('should load players and settings when requested', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            const result = await manager.getData({ players: true, teams: false, settings: true });

            // Should call data.get for players and getConsolidatedSettings
            expect(mockGet).toHaveBeenCalledTimes(1);
            expect(mockGet).toHaveBeenCalledWith('players', '2024-01-15', 'test-league');
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);

            // Result should contain players and settings
            expect(result).toHaveProperty('players');
            expect(result).not.toHaveProperty('teams');
            expect(result).toHaveProperty('settings');
        });

        it('should load all data when all options are true (default behavior)', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            const result = await manager.getData({ players: true, teams: true, settings: true });

            // Should call data.get for players and teams, and getConsolidatedSettings
            expect(mockGet).toHaveBeenCalledTimes(2);
            expect(mockGet).toHaveBeenCalledWith('players', '2024-01-15', 'test-league');
            expect(mockGet).toHaveBeenCalledWith('teams', '2024-01-15', 'test-league');
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);

            // Result should contain all data
            expect(result).toHaveProperty('players');
            expect(result).toHaveProperty('teams');
            expect(result).toHaveProperty('settings');
        });

        it('should default to loading all data when no options provided', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            const result = await manager.getData();

            // Should load all data by default
            expect(mockGet).toHaveBeenCalledTimes(2);
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);

            expect(result).toHaveProperty('players');
            expect(result).toHaveProperty('teams');
            expect(result).toHaveProperty('settings');
        });
    });

    describe('cache interaction with lazy loading', () => {
        it('should use cached data for partial requests when cache contains all data', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // First, load all data (this will populate cache)
            await manager.getData({ players: true, teams: true, settings: true });
            expect(mockGet).toHaveBeenCalledTimes(2);
            expect(mockGetConsolidatedSettings).toHaveBeenCalledTimes(1);

            // Reset mock call counts
            vi.clearAllMocks();

            // Now request only players - should use cache
            const result = await manager.getData({ players: true, teams: false, settings: false });

            // Should not make any new calls - data comes from cache
            expect(mockGet).not.toHaveBeenCalled();
            expect(mockGetConsolidatedSettings).not.toHaveBeenCalled();

            expect(result).toHaveProperty('players');
            expect(result).not.toHaveProperty('teams');
            expect(result).not.toHaveProperty('settings');
        });

        it('should load from disk when cache does not contain requested data', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // First, load only players data (partial cache)
            await manager.getData({ players: true, teams: false, settings: false });
            expect(mockGet).toHaveBeenCalledTimes(1);

            // Reset mock call counts
            vi.clearAllMocks();

            // Now request teams - cache doesn't have it, should load from disk
            const result = await manager.getData({ players: false, teams: true, settings: false });

            // Should make a new call for teams
            expect(mockGet).toHaveBeenCalledTimes(1);
            expect(mockGet).toHaveBeenCalledWith('teams', '2024-01-15', 'test-league');

            expect(result).not.toHaveProperty('players');
            expect(result).toHaveProperty('teams');
            expect(result).not.toHaveProperty('settings');
        });

        it('should only cache when loading full data set', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // Load partial data - should not cache
            await manager.getData({ players: true, teams: false, settings: false });

            // Reset and load same data again - should hit disk again
            vi.clearAllMocks();
            await manager.getData({ players: true, teams: false, settings: false });

            // Should make another call since partial data wasn't cached
            expect(mockGet).toHaveBeenCalledTimes(1);
        });
    });

    describe('performance optimization scenarios', () => {
        it('should demonstrate I/O reduction for read-only operations', async () => {
            const manager = createPlayerManager().setDate('2024-01-15').setLeague('test-league');

            // Simulate GET /api/players endpoint (only needs players)
            const playersResult = await manager.getData({
                players: true,
                teams: false,
                settings: false
            });

            // Simulate GET /api/teams endpoint (only needs teams)
            const teamsResult = await manager.getData({
                players: false,
                teams: true,
                settings: false
            });

            // Should have made only 2 disk reads total instead of 6 (3 per operation)
            expect(mockGet).toHaveBeenCalledTimes(2);
            expect(mockGetConsolidatedSettings).not.toHaveBeenCalled();

            expect(playersResult).toHaveProperty('players');
            expect(teamsResult).toHaveProperty('teams');
        });
    });
});
