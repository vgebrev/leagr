import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { teamsService } from '$lib/client/services/teams.svelte.js';

// Mock the API client
vi.mock('$lib/client/services/api-client.svelte.js', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        remove: vi.fn()
    }
}));

// Mock the Players service
vi.mock('$lib/client/services/players.svelte.js', () => ({
    playersService: {
        loadPlayers: vi.fn(),
        players: [],
        waitingList: []
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

describe('TeamsService', () => {
    let mockApi;
    let mockPlayersService;
    let mockSetNotification;
    let mockWithLoading;

    beforeEach(async () => {
        const { api } = await import('$lib/client/services/api-client.svelte.js');
        const { playersService } = await import('$lib/client/services/players.svelte.js');
        const { setNotification } = await import('$lib/client/stores/notification.js');
        const { withLoading } = await import('$lib/client/stores/loading.js');

        mockApi = api;
        mockPlayersService = playersService;
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
        teamsService.reset();

        // Mock canModifyList and isCompetitionEnded to return appropriate values
        Object.defineProperty(teamsService, 'isCompetitionEnded', {
            get: () => false,
            configurable: true
        });
        Object.defineProperty(mockPlayersService, 'canModifyList', {
            get: () => true,
            configurable: true
        });
    });

    afterEach(() => {
        teamsService.reset();
    });

    describe('loadTeams', () => {
        it('should load teams data and dependencies', async () => {
            const mockTeamsData = {
                'Team A': ['Alice', 'Bob'],
                'Team B': ['Charlie', null]
            };
            const mockConfigData = {
                playerCount: 4,
                configurations: [{ teams: 2, teamSizes: [2, 2] }]
            };

            mockApi.get
                .mockResolvedValueOnce(mockTeamsData) // teams data
                .mockResolvedValueOnce(mockConfigData); // configurations

            await teamsService.loadTeams('2025-01-25');

            expect(mockPlayersService.loadPlayers).toHaveBeenCalledWith('2025-01-25');
            expect(mockApi.get).toHaveBeenCalledWith('teams', '2025-01-25');
            expect(mockApi.get).toHaveBeenCalledWith('teams/configurations', '2025-01-25');
            expect(teamsService.currentDate).toBe('2025-01-25');
            expect(teamsService.teams).toEqual(mockTeamsData);
        });

        it('should handle missing teams data gracefully', async () => {
            mockApi.get
                .mockResolvedValueOnce(null) // teams data
                .mockResolvedValueOnce({ configurations: [] }); // configurations

            await teamsService.loadTeams('2025-01-25');

            expect(teamsService.teams).toEqual({});
        });

        it('should handle API errors', async () => {
            const mockError = new Error('Teams API Error');
            mockApi.get.mockRejectedValue(mockError);

            await teamsService.loadTeams('2025-01-25');

            expect(mockSetNotification).toHaveBeenCalledWith('Teams API Error', 'error');
        });
    });

    describe('loadTeamConfigurations', () => {
        beforeEach(() => {
            teamsService.currentDate = '2025-01-25';
        });

        it('should load team configurations', async () => {
            const mockConfigData = {
                playerCount: 6,
                configurations: [
                    { teams: 2, teamSizes: [3, 3] },
                    { teams: 3, teamSizes: [2, 2, 2] }
                ]
            };

            mockApi.get.mockResolvedValue(mockConfigData);

            await teamsService.loadTeamConfigurations();

            expect(mockApi.get).toHaveBeenCalledWith('teams/configurations', '2025-01-25');
            expect(teamsService.teamConfig).toEqual(mockConfigData.configurations);
        });

        it('should not load if no current date', async () => {
            teamsService.currentDate = null;

            await teamsService.loadTeamConfigurations();

            expect(mockApi.get).not.toHaveBeenCalled();
        });

        it('should handle API errors', async () => {
            const mockError = new Error('Config API Error');
            mockApi.get.mockRejectedValue(mockError);

            await teamsService.loadTeamConfigurations();

            expect(mockSetNotification).toHaveBeenCalledWith('Config API Error', 'error');
            expect(teamsService.teamConfig).toEqual([]);
        });
    });

    describe('generateTeams', () => {
        beforeEach(() => {
            teamsService.currentDate = '2025-01-25';
        });

        it('should generate teams successfully', async () => {
            const mockOptions = { teams: 2, teamSizes: [3, 3] };
            const mockResult = {
                teams: {
                    'Team A': ['Alice', 'Bob', 'Charlie'],
                    'Team B': ['Dave', 'Eve', 'Frank']
                },
                config: mockOptions
            };

            mockApi.post.mockResolvedValue(mockResult);

            const result = await teamsService.generateTeams(mockOptions);

            expect(mockApi.post).toHaveBeenCalledWith('teams', '2025-01-25', {
                method: 'seeded', // default from settings
                teamConfig: mockOptions
            });
            expect(teamsService.teams).toEqual(mockResult.teams);
            expect(result).toBe(true);
        });

        it('should not generate if date is in past', async () => {
            Object.defineProperty(teamsService, 'isCompetitionEnded', {
                get: () => true,
                configurable: true
            });

            const result = await teamsService.generateTeams({ teams: 2 });

            expect(mockApi.post).not.toHaveBeenCalled();
            expect(result).toBe(false);
            expect(mockSetNotification).toHaveBeenCalledWith('Teams cannot be changed.', 'warning');
        });

        it('should validate options are provided', async () => {
            const result = await teamsService.generateTeams(null);

            expect(mockApi.post).not.toHaveBeenCalled();
            expect(result).toBe(false);
            expect(mockSetNotification).toHaveBeenCalledWith(
                'Please choose a team option.',
                'warning'
            );
        });

        it('should restore teams on API error', async () => {
            const originalTeams = { 'Team A': ['Alice'] };
            teamsService.teams = { ...originalTeams };

            const mockError = new Error('Generate Teams Error');
            mockApi.post.mockRejectedValue(mockError);

            const result = await teamsService.generateTeams({ teams: 2 });

            expect(result).toBe(false);
            expect(teamsService.teams).toEqual(originalTeams);
            expect(mockSetNotification).toHaveBeenCalledWith('Generate Teams Error', 'error');
        });
    });

    describe('removePlayer', () => {
        beforeEach(() => {
            teamsService.currentDate = '2025-01-25';
            teamsService.teams = {
                'Team A': ['Alice', 'Bob'],
                'Team B': ['Charlie', null]
            };
            mockPlayersService.players = ['Alice', 'Bob', 'Charlie'];
            mockPlayersService.waitingList = [];
        });

        it('should remove player and update state', async () => {
            const mockResult = {
                teams: {
                    'Team A': ['Alice', null],
                    'Team B': ['Charlie', null]
                },
                players: {
                    available: ['Alice', 'Charlie'],
                    waitingList: ['Bob']
                }
            };

            mockApi.remove.mockResolvedValue(mockResult);
            mockApi.get.mockResolvedValue({ configurations: [] }); // for loadTeamConfigurations

            await teamsService.removePlayer('Bob', 'waitingList');

            expect(mockApi.remove).toHaveBeenCalledWith('teams/players', '2025-01-25', {
                playerName: 'Bob',
                teamName: 'Team A', // auto-detected
                action: 'waitingList'
            });
            expect(teamsService.teams).toEqual(mockResult.teams);
            expect(mockPlayersService.players).toEqual(mockResult.players.available);
            expect(mockPlayersService.waitingList).toEqual(mockResult.players.waitingList);
        });

        it('should auto-detect team name when not provided', async () => {
            const mockResult = {
                teams: { 'Team A': ['Alice', null], 'Team B': ['Charlie', null] },
                players: { available: ['Alice', 'Charlie'], waitingList: ['Bob'] }
            };

            mockApi.remove.mockResolvedValue(mockResult);
            mockApi.get.mockResolvedValue({ configurations: [] });

            await teamsService.removePlayer('Bob'); // no teamName provided

            expect(mockApi.remove).toHaveBeenCalledWith('teams/players', '2025-01-25', {
                playerName: 'Bob',
                teamName: 'Team A', // auto-detected from Teams state
                action: 'waitingList'
            });
        });

        it('should not remove if date is in past', async () => {
            Object.defineProperty(teamsService, 'isCompetitionEnded', {
                get: () => true,
                configurable: true
            });

            await teamsService.removePlayer('Bob');

            expect(mockApi.remove).not.toHaveBeenCalled();
            expect(mockSetNotification).toHaveBeenCalledWith(
                'Players cannot be changed.',
                'warning'
            );
        });
    });

    describe('assignPlayerToTeam', () => {
        beforeEach(() => {
            teamsService.currentDate = '2025-01-25';
            teamsService.teams = {
                'Team A': ['Alice', null],
                'Team B': ['Charlie', null]
            };
            mockPlayersService.players = ['Alice', 'Charlie'];
            mockPlayersService.waitingList = ['Bob'];
        });

        it('should assign player to team', async () => {
            const mockResult = {
                teams: {
                    'Team A': ['Alice', 'Bob'],
                    'Team B': ['Charlie', null]
                },
                players: {
                    available: ['Alice', 'Bob', 'Charlie'],
                    waitingList: []
                }
            };

            mockApi.post.mockResolvedValue(mockResult);
            mockApi.get.mockResolvedValue({ configurations: [] });

            await teamsService.assignPlayerToTeam('Bob', 'Team A');

            expect(mockApi.post).toHaveBeenCalledWith('teams/players', '2025-01-25', {
                playerName: 'Bob',
                teamName: 'Team A'
            });
            expect(teamsService.teams).toEqual(mockResult.teams);
            expect(mockPlayersService.players).toEqual(mockResult.players.available);
            expect(mockPlayersService.waitingList).toEqual(mockResult.players.waitingList);
        });

        it('should auto-select first unassigned player if none specified', async () => {
            Object.defineProperty(teamsService, 'unassignedPlayers', {
                get: () => [],
                configurable: true
            });

            const mockResult = {
                teams: { 'Team A': ['Alice', 'Bob'], 'Team B': ['Charlie', null] },
                players: { available: ['Alice', 'Bob', 'Charlie'], waitingList: [] }
            };

            mockApi.post.mockResolvedValue(mockResult);
            mockApi.get.mockResolvedValue({ configurations: [] });

            await teamsService.assignPlayerToTeam(null, 'Team A');

            expect(mockApi.post).toHaveBeenCalledWith('teams/players', '2025-01-25', {
                playerName: 'Bob', // first from the waiting list
                teamName: 'Team A'
            });
        });

        it('should show info if no unassigned players available', async () => {
            Object.defineProperty(teamsService, 'unassignedPlayers', {
                get: () => [],
                configurable: true
            });
            mockPlayersService.waitingList = [];

            await teamsService.assignPlayerToTeam(null, 'Team A');

            expect(mockApi.post).not.toHaveBeenCalled();
            expect(mockSetNotification).toHaveBeenCalledWith(
                'No unassigned players available.',
                'info'
            );
        });
    });

    describe('reset', () => {
        it('should reset all state to initial values', () => {
            teamsService.teams = { 'Team A': ['Alice'] };
            teamsService.currentDate = '2025-01-25';

            teamsService.reset();

            expect(teamsService.teams).toEqual({});
            expect(teamsService.currentDate).toBeNull();
        });
    });

    describe('getAllPlayers', () => {
        it('should return combined players and waiting list', () => {
            mockPlayersService.players = ['Alice', 'Bob'];
            mockPlayersService.waitingList = ['Charlie'];

            const result = teamsService.getAllPlayers();

            expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
        });
    });
});
