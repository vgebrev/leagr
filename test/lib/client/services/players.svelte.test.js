import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playersService } from '$lib/client/services/players.svelte.js';

// Mock the API client
vi.mock('$lib/client/services/api-client.svelte.js', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        remove: vi.fn(),
        patch: vi.fn()
    }
}));

// Mock the notification store
vi.mock('$lib/client/stores/notification.js', () => ({
    setNotification: vi.fn()
}));

// Mock the loading store
vi.mock('$lib/client/stores/loading.js', () => ({
    withLoading: vi.fn((fn) => fn())
}));

// Mock the settings store
vi.mock('$lib/client/stores/settings.js', () => ({
    settings: {
        subscribe: vi.fn()
    }
}));

describe('PlayersService', () => {
    let mockApi;
    let mockSetNotification;
    let mockWithLoading;

    beforeEach(async () => {
        const { api } = await import('$lib/client/services/api-client.svelte.js');
        const { setNotification } = await import('$lib/client/stores/notification.js');
        const { withLoading } = await import('$lib/client/stores/loading.js');

        mockApi = api;
        mockSetNotification = setNotification;
        mockWithLoading = withLoading;

        // Reset all mocks
        vi.clearAllMocks();

        // Set up withLoading to handle both success and error cases
        mockWithLoading.mockImplementation(async (fn, errorHandler) => {
            try {
                await fn();
            } catch (err) {
                if (errorHandler) {
                    errorHandler(err);
                } else {
                    throw err;
                }
            }
        });

        // Reset service state
        playersService.reset();

        // Mock canModifyList to return true by default
        Object.defineProperty(playersService, 'canModifyList', {
            get: () => true,
            configurable: true
        });
    });

    afterEach(() => {
        playersService.reset();
    });

    describe('loadPlayers', () => {
        it('should load players data and set current date', async () => {
            const mockPlayerData = {
                available: ['Alice', 'Bob'],
                waitingList: ['Charlie']
            };

            mockApi.get.mockResolvedValue(mockPlayerData);

            await playersService.loadPlayers('2025-01-25');

            expect(mockApi.get).toHaveBeenCalledWith('players', '2025-01-25');
            expect(playersService.currentDate).toBe('2025-01-25');
            expect(playersService.players).toEqual(['Alice', 'Bob']);
            expect(playersService.waitingList).toEqual(['Charlie']);
        });

        it('should handle missing player data gracefully', async () => {
            mockApi.get.mockResolvedValue(null);

            await playersService.loadPlayers('2025-01-25');

            expect(playersService.players).toEqual([]);
            expect(playersService.waitingList).toEqual([]);
        });

        it('should handle API errors', async () => {
            const mockError = new Error('API Error');
            mockApi.get.mockRejectedValue(mockError);

            await playersService.loadPlayers('2025-01-25');

            expect(mockSetNotification).toHaveBeenCalledWith('API Error', 'error');
        });
    });

    describe('loadRankedPlayerNames', () => {
        it('should load ranked players if not already loaded', async () => {
            const mockRankedPlayers = ['Alice', 'Bob', 'Charlie'];
            mockApi.get.mockResolvedValue(mockRankedPlayers);

            await playersService.loadRankedPlayerNames();

            expect(mockApi.get).toHaveBeenCalledWith('players/ranked');
            expect(playersService.rankedPlayers).toEqual(mockRankedPlayers);
        });

        it('should not reload if ranked players already exist', async () => {
            // Set some initial ranked players
            playersService.rankedPlayers = ['Existing'];

            await playersService.loadRankedPlayerNames();

            expect(mockApi.get).not.toHaveBeenCalled();
            expect(playersService.rankedPlayers).toEqual(['Existing']);
        });

        it('should handle API errors', async () => {
            const mockError = new Error('Ranked API Error');
            mockApi.get.mockRejectedValue(mockError);

            await playersService.loadRankedPlayerNames();

            expect(mockSetNotification).toHaveBeenCalledWith('Ranked API Error', 'error');
            expect(playersService.rankedPlayers).toEqual([]);
        });
    });

    describe('addPlayer', () => {
        beforeEach(() => {
            playersService.currentDate = '2025-01-25';
        });

        it('should add player successfully', async () => {
            const mockResult = {
                available: ['Alice', 'Bob'],
                waitingList: []
            };

            mockApi.post.mockResolvedValue(mockResult);

            const result = await playersService.addPlayer('Bob', 'available');

            expect(mockApi.post).toHaveBeenCalledWith('players', '2025-01-25', {
                playerName: 'Bob',
                list: 'available'
            });
            expect(playersService.players).toEqual(['Alice', 'Bob']);
            expect(playersService.waitingList).toEqual([]);
            expect(result).toBe(true);
        });

        it('should reject invalid player names', async () => {
            const result = await playersService.addPlayer('', 'available');

            expect(mockApi.post).not.toHaveBeenCalled();
            expect(result).toBe(false);
            expect(mockSetNotification).toHaveBeenCalledWith(
                'Player name cannot be empty',
                'warning'
            );
        });

        it('should prevent duplicate players', async () => {
            playersService.players = ['Alice'];

            const result = await playersService.addPlayer('Alice', 'available');

            expect(mockApi.post).not.toHaveBeenCalled();
            expect(result).toBe(false);
            expect(mockSetNotification).toHaveBeenCalledWith(
                'Player Alice already added.',
                'warning'
            );
        });

        it('should handle API errors', async () => {
            const mockError = new Error('Add Player Error');
            mockApi.post.mockRejectedValue(mockError);

            const result = await playersService.addPlayer('Bob', 'available');

            expect(result).toBe(false);
            expect(mockSetNotification).toHaveBeenCalledWith('Add Player Error', 'error');
        });
    });

    describe('removePlayer', () => {
        beforeEach(() => {
            playersService.currentDate = '2025-01-25';
            playersService.players = ['Alice', 'Bob'];
            playersService.waitingList = ['Charlie'];
        });

        it('should remove player from available list', async () => {
            const mockResult = {
                available: ['Alice'],
                waitingList: ['Charlie']
            };

            mockApi.remove.mockResolvedValue(mockResult);

            await playersService.removePlayer('Bob', 'available');

            expect(mockApi.remove).toHaveBeenCalledWith('players', '2025-01-25', {
                playerName: 'Bob',
                list: 'available'
            });
            expect(playersService.players).toEqual(['Alice']);
            expect(playersService.waitingList).toEqual(['Charlie']);
        });

        it('should remove player from waiting list', async () => {
            const mockResult = {
                available: ['Alice', 'Bob'],
                waitingList: []
            };

            mockApi.remove.mockResolvedValue(mockResult);

            await playersService.removePlayer('Charlie', 'waitingList');

            expect(mockApi.remove).toHaveBeenCalledWith('players', '2025-01-25', {
                playerName: 'Charlie',
                list: 'waitingList'
            });
            expect(playersService.players).toEqual(['Alice', 'Bob']);
            expect(playersService.waitingList).toEqual([]);
        });

        it('should not remove non-existent players', async () => {
            await playersService.removePlayer('NonExistent', 'available');

            expect(mockApi.remove).not.toHaveBeenCalled();
        });
    });

    describe('movePlayer', () => {
        beforeEach(() => {
            playersService.currentDate = '2025-01-25';
        });

        it('should move player between lists', async () => {
            const mockResult = {
                available: ['Alice'],
                waitingList: ['Bob']
            };

            mockApi.patch.mockResolvedValue(mockResult);

            await playersService.movePlayer('Bob', 'available', 'waitingList');

            expect(mockApi.patch).toHaveBeenCalledWith('players', '2025-01-25', {
                playerName: 'Bob',
                fromList: 'available',
                toList: 'waitingList'
            });
            expect(playersService.players).toEqual(['Alice']);
            expect(playersService.waitingList).toEqual(['Bob']);
        });

        it('should not move if source and target are the same', async () => {
            await playersService.movePlayer('Bob', 'available', 'available');

            expect(mockApi.patch).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        it('should reset all state to initial values', () => {
            playersService.players = ['Alice'];
            playersService.waitingList = ['Bob'];
            playersService.currentDate = '2025-01-25';

            playersService.reset();

            expect(playersService.players).toEqual([]);
            expect(playersService.waitingList).toEqual([]);
            expect(playersService.currentDate).toBeNull();
        });
    });
});
