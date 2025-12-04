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

describe('PlayerManager', () => {
    let playerManager;
    let mockData;
    let mockGetConsolidatedSettings;

    beforeEach(async () => {
        playerManager = new PlayerManager();

        // Get the mocked modules
        const { data } = await import('$lib/server/data.js');
        const { getConsolidatedSettings } = await import('$lib/server/settings.js');

        mockData = data;
        mockGetConsolidatedSettings = getConsolidatedSettings;

        // Reset all mocks
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should create a PlayerManager instance', () => {
            expect(playerManager).toBeInstanceOf(PlayerManager);
            expect(playerManager.date).toBeNull();
            expect(playerManager.leagueId).toBeNull();
        });

        it('should allow method chaining for setDate and setLeague', () => {
            const result = playerManager.setDate('2025-01-25').setLeague('test-league');
            expect(result).toBe(playerManager);
            expect(playerManager.date).toBe('2025-01-25');
            expect(playerManager.leagueId).toBe('test-league');
        });
    });

    describe('getData', () => {
        beforeEach(() => {
            playerManager.setDate('2025-01-25').setLeague('test-league');
        });

        it('should fetch and return game data with default values', async () => {
            // Mock data responses
            mockData.get
                .mockResolvedValueOnce(null) // players
                .mockResolvedValueOnce(null); // teams

            mockGetConsolidatedSettings.mockResolvedValue({
                playerLimit: 24,
                registrationWindow: { enabled: true }
            });

            const result = await playerManager.getData();

            expect(mockData.get).toHaveBeenCalledWith('players', '2025-01-25', 'test-league');
            expect(mockData.get).toHaveBeenCalledWith('teams', '2025-01-25', 'test-league');
            expect(mockGetConsolidatedSettings).toHaveBeenCalledWith('2025-01-25', 'test-league');

            expect(result).toMatchObject({
                players: { available: [], waitingList: [] },
                teams: {},
                settings: expect.objectContaining({
                    playerLimit: 24,
                    registrationWindow: { enabled: true }
                })
            });
        });

        it('should return existing data when available', async () => {
            const mockPlayers = { available: ['John', 'Jane'], waitingList: ['Bob'] };
            const mockTeams = { 'Team A': ['John', null], 'Team B': ['Jane', null] };
            const mockSettings = { playerLimit: 20 };

            mockData.get.mockResolvedValueOnce(mockPlayers).mockResolvedValueOnce(mockTeams);
            mockGetConsolidatedSettings.mockResolvedValue(mockSettings);

            const result = await playerManager.getData();

            expect(result.players).toEqual(mockPlayers);
            expect(result.teams).toEqual(mockTeams);
            expect(result.settings).toEqual(mockSettings);
        });
    });

    describe('addPlayer', () => {
        beforeEach(() => {
            playerManager.setDate('2025-01-25').setLeague('test-league');
        });

        it('should add player to available list when under limit', async () => {
            const mockGameData = {
                players: { available: ['John'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.addPlayer('Jane', 'available');

            expect(mockData.setMany).toHaveBeenCalledWith(
                [
                    {
                        key: 'players',
                        value: { available: ['John', 'Jane'], waitingList: [] },
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    }
                ],
                '2025-01-25',
                'test-league'
            );

            expect(result).toEqual({ available: ['John', 'Jane'], waitingList: [] });
        });

        it('should throw PlayerError when player already exists', async () => {
            const mockGameData = {
                players: { available: ['John'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);

            await expect(playerManager.addPlayer('John', 'available')).rejects.toThrow(PlayerError);

            await expect(playerManager.addPlayer('John', 'available')).rejects.toThrow(
                'Player John is already registered.'
            );
        });

        it('should redirect to waiting list when player limit reached', async () => {
            const mockGameData = {
                players: {
                    available: Array(24)
                        .fill()
                        .map((_, i) => `Player${i}`),
                    waitingList: []
                },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.addPlayer('NewPlayer', 'available');

            expect(result.waitingList).toContain('NewPlayer');
            expect(result.available).not.toContain('NewPlayer');
        });
    });

    describe('removePlayer', () => {
        beforeEach(() => {
            playerManager.setDate('2025-01-25').setLeague('test-league');
        });

        it('should remove player completely from all lists', async () => {
            const mockGameData = {
                players: { available: ['John', 'Jane'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.removePlayer('John');

            expect(mockData.setMany).toHaveBeenCalledWith(
                [
                    {
                        key: 'players',
                        value: { available: ['Jane'], waitingList: [] },
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    }
                ],
                '2025-01-25',
                'test-league'
            );

            expect(result).toEqual({
                players: { available: ['Jane'], waitingList: [] },
                teams: expect.any(Object)
            });
        });

        it('should remove player from team when assigned', async () => {
            const mockGameData = {
                players: { available: ['John', 'Jane'], waitingList: [] },
                teams: { 'Team A': ['John', 'Jane'], 'Team B': [null, null] },
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.removePlayer('John');

            expect(mockData.setMany).toHaveBeenCalledWith(
                [
                    {
                        key: 'players',
                        value: { available: ['Jane'], waitingList: [] },
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    },
                    {
                        key: 'teams',
                        value: { 'Team A': [null, 'Jane'], 'Team B': [null, null] },
                        defaultValue: {},
                        overwrite: true
                    }
                ],
                '2025-01-25',
                'test-league'
            );
            expect(result).toEqual({
                players: { available: ['Jane'], waitingList: [] },
                teams: expect.any(Object)
            });
        });
    });

    describe('movePlayer', () => {
        beforeEach(() => {
            playerManager.setDate('2025-01-25').setLeague('test-league');
        });

        it('should move player from available to waiting list', async () => {
            const mockGameData = {
                players: { available: ['John', 'Jane'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.movePlayer('John', 'available', 'waitingList');

            expect(result).toEqual({ available: ['Jane'], waitingList: ['John'] });
        });

        it('should throw PlayerError when player not in source list', async () => {
            const mockGameData = {
                players: { available: ['Jane'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);

            await expect(
                playerManager.movePlayer('John', 'available', 'waitingList')
            ).rejects.toThrow(PlayerError);

            // Updated to match PlayerState's more general error message
            await expect(
                playerManager.movePlayer('John', 'available', 'waitingList')
            ).rejects.toThrow('Player John is not registered.');
        });

        it('should throw PlayerError when player limit reached', async () => {
            const mockGameData = {
                players: { available: ['Jane', 'Bob', 'Alice', 'Tom'], waitingList: ['John'] },
                teams: {},
                settings: { playerLimit: 4 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);

            await expect(
                playerManager.movePlayer('John', 'waitingList', 'available')
            ).rejects.toThrow(PlayerError);
            await expect(
                playerManager.movePlayer('John', 'waitingList', 'available')
            ).rejects.toThrow('Player limit of 4 reached');
        });
    });

    describe('renamePlayer', () => {
        beforeEach(() => {
            playerManager.setDate('2025-01-25').setLeague('test-league');
        });

        it('should rename player in available list', async () => {
            const mockGameData = {
                players: { available: ['Jhon', 'Jane'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.renamePlayer('Jhon', 'John');

            expect(mockData.setMany).toHaveBeenCalledWith(
                [
                    {
                        key: 'players',
                        value: { available: ['John', 'Jane'], waitingList: [] },
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    }
                ],
                '2025-01-25',
                'test-league'
            );

            expect(result).toEqual({ available: ['John', 'Jane'], waitingList: [] });
        });

        it('should rename player in waiting list', async () => {
            const mockGameData = {
                players: { available: ['Jane'], waitingList: ['Jhon'] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.renamePlayer('Jhon', 'John');

            expect(result).toEqual({ available: ['Jane'], waitingList: ['John'] });
        });

        it('should rename player in teams and available list', async () => {
            const mockGameData = {
                players: { available: ['Jhon', 'Jane', 'Bob'], waitingList: [] },
                teams: {
                    'Team A': ['Jhon', 'Jane'],
                    'Team B': ['Bob', null]
                },
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);
            mockData.setMany.mockResolvedValue({});

            const result = await playerManager.renamePlayer('Jhon', 'John');

            expect(mockData.setMany).toHaveBeenCalledWith(
                expect.arrayContaining([
                    {
                        key: 'players',
                        value: { available: ['John', 'Jane', 'Bob'], waitingList: [] },
                        defaultValue: { available: [], waitingList: [] },
                        overwrite: true
                    },
                    {
                        key: 'teams',
                        value: {
                            'Team A': ['John', 'Jane'],
                            'Team B': ['Bob', null]
                        },
                        defaultValue: {},
                        overwrite: true
                    }
                ]),
                '2025-01-25',
                'test-league'
            );

            expect(result).toEqual({ available: ['John', 'Jane', 'Bob'], waitingList: [] });
        });

        it('should throw PlayerError when old name does not exist', async () => {
            const mockGameData = {
                players: { available: ['Jane'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);

            await expect(playerManager.renamePlayer('John', 'Johnny')).rejects.toThrow(PlayerError);
            await expect(playerManager.renamePlayer('John', 'Johnny')).rejects.toThrow(
                'Player John is not registered.'
            );
        });

        it('should throw PlayerError when new name already exists', async () => {
            const mockGameData = {
                players: { available: ['John', 'Jane'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);

            await expect(playerManager.renamePlayer('John', 'Jane')).rejects.toThrow(PlayerError);
            await expect(playerManager.renamePlayer('John', 'Jane')).rejects.toThrow(
                'Player Jane is already registered.'
            );
        });

        it('should update player ownership mapping', async () => {
            const mockGameData = {
                players: { available: ['Jhon', 'Jane'], waitingList: [] },
                teams: {},
                settings: { playerLimit: 24 }
            };

            // Mock the access control and ownership
            const mockAccessControl = {
                deriveOwnerId: vi.fn().mockReturnValue('owner123'),
                isOwner: vi.fn().mockReturnValue(true)
            };

            playerManager.setAccessControl(mockAccessControl);

            vi.spyOn(playerManager, 'getData').mockResolvedValue(mockGameData);

            // Mock the get for playerOwners to simulate existing ownership
            mockData.get.mockResolvedValueOnce({ Jhon: 'owner123' });
            mockData.setMany.mockResolvedValue({});

            await playerManager.renamePlayer('Jhon', 'John');

            // Verify that setMany was called with playerOwners update
            expect(mockData.setMany).toHaveBeenCalledWith(
                expect.arrayContaining([
                    {
                        key: 'playerOwners',
                        value: { John: 'owner123' },
                        defaultValue: {},
                        overwrite: true
                    }
                ]),
                '2025-01-25',
                'test-league'
            );
        });
    });
});

describe('PlayerError', () => {
    it('should create PlayerError with default status code 500', () => {
        const error = new PlayerError('Test error');
        expect(error).toBeInstanceOf(PlayerError);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe('PlayerError');
    });

    it('should create PlayerError with custom status code', () => {
        const error = new PlayerError('Validation error', 400);
        expect(error.message).toBe('Validation error');
        expect(error.statusCode).toBe(400);
    });
});
