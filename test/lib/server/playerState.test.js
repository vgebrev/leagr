import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerState, PlayerError } from '$lib/server/playerManager.js';

describe('PlayerState', () => {
    let mockPlayers, mockTeams, mockSettings, playerState;

    beforeEach(() => {
        mockPlayers = { available: [], waitingList: [] };
        mockTeams = { 'Team A': [null, null], 'Team B': [null, null] };
        mockSettings = { playerLimit: 4 };
        playerState = new PlayerState(mockPlayers, mockTeams, mockSettings);
    });

    describe('constructor', () => {
        it('should create a deep copy of players, teams, and settings', () => {
            const originalPlayers = { available: ['John'], waitingList: ['Jane'] };
            const originalTeams = { 'Team A': ['John', null] };
            const state = new PlayerState(originalPlayers, originalTeams, mockSettings);

            // Modify original data
            originalPlayers.available.push('Bob');
            originalTeams['Team A'][1] = 'Jane';

            // State should remain unchanged
            expect(state.players.available).toEqual(['John']);
            expect(state.teams['Team A']).toEqual(['John', null]);
        });
    });

    describe('getPlayerLocation', () => {
        it('should return null location for unregistered player', () => {
            const location = playerState.getPlayerLocation('Unknown');
            expect(location).toEqual({ location: null, isAssigned: false });
        });

        it('should identify player in available list without team assignment', () => {
            playerState.players.available = ['John'];

            const location = playerState.getPlayerLocation('John');
            expect(location).toEqual({
                location: 'available',
                isAssigned: false
            });
        });

        it('should identify player in available list with team assignment', () => {
            playerState.players.available = ['John'];
            playerState.teams['Team A'] = ['John', null];

            const location = playerState.getPlayerLocation('John');
            expect(location).toEqual({
                location: 'available',
                teamName: 'Team A',
                isAssigned: true
            });
        });

        it('should identify player in waiting list', () => {
            playerState.players.waitingList = ['John'];

            const location = playerState.getPlayerLocation('John');
            expect(location).toEqual({
                location: 'waiting',
                isAssigned: false
            });
        });
    });

    describe('validateState', () => {
        it('should pass validation for consistent state', () => {
            playerState.players.available = ['John', 'Jane'];
            playerState.players.waitingList = ['Bob'];
            playerState.teams['Team A'] = ['John', null];

            expect(() => playerState.validateState()).not.toThrow();
        });

        it('should throw error for player in both lists', () => {
            playerState.players.available = ['John'];
            playerState.players.waitingList = ['John'];

            expect(() => playerState.validateState()).toThrow(PlayerError);
            expect(() => playerState.validateState()).toThrow(
                'Player John exists in both available and waiting lists'
            );
        });

        it('should throw error for assigned player not in available list', () => {
            playerState.teams['Team A'] = ['John', null];
            // John is not in available list

            expect(() => playerState.validateState()).toThrow(PlayerError);
            expect(() => playerState.validateState()).toThrow(
                'Assigned player John not in available list'
            );
        });

        it('should throw error when available players exceed limit', () => {
            playerState.players.available = ['John', 'Jane', 'Bob', 'Alice', 'Charlie']; // 5 > 4 limit

            expect(() => playerState.validateState()).toThrow(PlayerError);
            expect(() => playerState.validateState()).toThrow(
                'Available players exceed limit of 4'
            );
        });
    });

    describe('addPlayer', () => {
        it('should add player to available list when under limit', () => {
            const newState = playerState.addPlayer('John', 'available');

            expect(newState.players.available).toContain('John');
            expect(newState.players.waitingList).not.toContain('John');
            expect(newState).not.toBe(playerState); // Should return new instance
        });

        it('should auto-redirect to waiting list when at limit', () => {
            playerState.players.available = ['John', 'Jane', 'Bob', 'Alice']; // At limit

            const newState = playerState.addPlayer('Charlie', 'available');

            expect(newState.players.available).not.toContain('Charlie');
            expect(newState.players.waitingList).toContain('Charlie');
        });

        it('should handle auto target when under limit', () => {
            const newState = playerState.addPlayer('John', 'auto');

            expect(newState.players.available).toContain('John');
            expect(newState.players.waitingList).not.toContain('John');
        });

        it('should handle auto target when at limit', () => {
            playerState.players.available = ['John', 'Jane', 'Bob', 'Alice'];

            const newState = playerState.addPlayer('Charlie', 'auto');

            expect(newState.players.available).not.toContain('Charlie');
            expect(newState.players.waitingList).toContain('Charlie');
        });

        it('should throw error for duplicate player in available list', () => {
            playerState.players.available = ['John'];

            expect(() => playerState.addPlayer('John')).toThrow(PlayerError);
            expect(() => playerState.addPlayer('John')).toThrow(
                'Player John is already registered.'
            );
        });

        it('should throw error for duplicate player in waiting list', () => {
            playerState.players.waitingList = ['John'];

            expect(() => playerState.addPlayer('John')).toThrow(PlayerError);
            expect(() => playerState.addPlayer('John')).toThrow(
                'Player John is already registered.'
            );
        });

        it('should handle explicit waiting list target', () => {
            const newState = playerState.addPlayer('John', 'waitingList');

            expect(newState.players.available).not.toContain('John');
            expect(newState.players.waitingList).toContain('John');
        });
    });

    describe('removePlayer', () => {
        it('should remove player from available list only', () => {
            playerState.players.available = ['John', 'Jane'];

            const newState = playerState.removePlayer('John');

            expect(newState.players.available).toEqual(['Jane']);
            expect(newState.players.waitingList).toEqual([]);
        });

        it('should remove player from waiting list', () => {
            playerState.players.waitingList = ['John', 'Jane'];

            const newState = playerState.removePlayer('John');

            expect(newState.players.available).toEqual([]);
            expect(newState.players.waitingList).toEqual(['Jane']);
        });

        it('should remove player from teams when assigned', () => {
            playerState.players.available = ['John', 'Jane'];
            playerState.teams['Team A'] = ['John', 'Jane'];
            playerState.teams['Team B'] = ['John', null];

            const newState = playerState.removePlayer('John');

            expect(newState.players.available).toEqual(['Jane']);
            expect(newState.teams['Team A']).toEqual([null, 'Jane']);
            expect(newState.teams['Team B']).toEqual([null, null]);
        });

        it('should throw error for unregistered player', () => {
            expect(() => playerState.removePlayer('Unknown')).toThrow(PlayerError);
            expect(() => playerState.removePlayer('Unknown')).toThrow(
                'Player Unknown is not registered.'
            );
        });
    });

    describe('movePlayerToTeam', () => {
        it('should assign unassigned available player to team', () => {
            playerState.players.available = ['John'];

            const newState = playerState.movePlayerToTeam('John', 'Team A');

            expect(newState.teams['Team A']).toContain('John');
            expect(newState.players.available).toContain('John'); // Should remain in available
        });

        it('should move waiting list player to team and available list', () => {
            playerState.players.waitingList = ['John'];

            const newState = playerState.movePlayerToTeam('John', 'Team A');

            expect(newState.teams['Team A']).toContain('John');
            expect(newState.players.available).toContain('John');
            expect(newState.players.waitingList).not.toContain('John');
        });

        it('should throw error for already assigned player', () => {
            playerState.players.available = ['John'];
            playerState.teams['Team A'] = ['John', null];

            expect(() => playerState.movePlayerToTeam('John', 'Team B')).toThrow(PlayerError);
            expect(() => playerState.movePlayerToTeam('John', 'Team B')).toThrow(
                'Player John is already assigned to team Team A.'
            );
        });

        it('should throw error for non-existent team', () => {
            playerState.players.available = ['John'];

            expect(() => playerState.movePlayerToTeam('John', 'Team C')).toThrow(PlayerError);
            expect(() => playerState.movePlayerToTeam('John', 'Team C')).toThrow(
                'Team Team C does not exist.'
            );
        });

        it('should throw error when team has no empty slots', () => {
            playerState.players.available = ['John', 'Jane', 'Bob'];
            playerState.teams['Team A'] = ['Jane', 'Bob']; // No empty slots

            expect(() => playerState.movePlayerToTeam('John', 'Team A')).toThrow(PlayerError);
            expect(() => playerState.movePlayerToTeam('John', 'Team A')).toThrow(
                'Team Team A has no empty slots.'
            );
        });

        it('should throw error when moving from waiting exceeds player limit', () => {
            playerState.players.available = ['Jane', 'Bob', 'Alice', 'Charlie']; // At limit
            playerState.players.waitingList = ['John'];

            expect(() => playerState.movePlayerToTeam('John', 'Team A')).toThrow(PlayerError);
            expect(() => playerState.movePlayerToTeam('John', 'Team A')).toThrow(
                'Player limit of 4 reached.'
            );
        });

        it('should throw error for unregistered player', () => {
            expect(() => playerState.movePlayerToTeam('Unknown', 'Team A')).toThrow(PlayerError);
            expect(() => playerState.movePlayerToTeam('Unknown', 'Team A')).toThrow(
                'Player Unknown is not registered.'
            );
        });
    });

    describe('movePlayerToWaiting', () => {
        it('should move assigned player from team to waiting list', () => {
            playerState.players.available = ['John'];
            playerState.teams['Team A'] = ['John', null];

            const newState = playerState.movePlayerToWaiting('John');

            expect(newState.teams['Team A']).toEqual([null, null]);
            expect(newState.players.available).not.toContain('John');
            expect(newState.players.waitingList).toContain('John');
        });

        it('should throw error for unassigned player', () => {
            playerState.players.available = ['John'];

            expect(() => playerState.movePlayerToWaiting('John')).toThrow(PlayerError);
            expect(() => playerState.movePlayerToWaiting('John')).toThrow(
                'Player John is not assigned to any team.'
            );
        });

        it('should throw error for unregistered player', () => {
            expect(() => playerState.movePlayerToWaiting('Unknown')).toThrow(PlayerError);
            expect(() => playerState.movePlayerToWaiting('Unknown')).toThrow(
                'Player Unknown is not registered.'
            );
        });
    });

    describe('movePlayerBetweenLists', () => {
        it('should move player from available to waiting', () => {
            playerState.players.available = ['John'];

            const newState = playerState.movePlayerBetweenLists('John', 'available', 'waitingList');

            expect(newState.players.available).not.toContain('John');
            expect(newState.players.waitingList).toContain('John');
        });

        it('should move player from waiting to available when under limit', () => {
            playerState.players.waitingList = ['John'];

            const newState = playerState.movePlayerBetweenLists('John', 'waitingList', 'available');

            expect(newState.players.available).toContain('John');
            expect(newState.players.waitingList).not.toContain('John');
        });

        it('should remove from team when moving to waiting list', () => {
            playerState.players.available = ['John'];
            playerState.teams['Team A'] = ['John', null];

            const newState = playerState.movePlayerBetweenLists('John', 'available', 'waitingList');

            expect(newState.teams['Team A']).toEqual([null, null]);
            expect(newState.players.waitingList).toContain('John');
        });

        it('should throw error when moving to available exceeds limit', () => {
            playerState.players.available = ['Jane', 'Bob', 'Alice', 'Charlie']; // At limit
            playerState.players.waitingList = ['John'];

            expect(() =>
                playerState.movePlayerBetweenLists('John', 'waitingList', 'available')
            ).toThrow(PlayerError);
            expect(() =>
                playerState.movePlayerBetweenLists('John', 'waitingList', 'available')
            ).toThrow('Player limit of 4 reached.');
        });

        it('should return same state when fromList equals toList', () => {
            playerState.players.available = ['John'];

            const newState = playerState.movePlayerBetweenLists('John', 'available', 'available');

            expect(newState).toBe(playerState); // Should return same instance
        });

        it('should throw error for invalid source list', () => {
            playerState.players.available = ['John'];

            expect(() =>
                playerState.movePlayerBetweenLists('John', 'waitingList', 'available')
            ).toThrow(PlayerError);
            expect(() =>
                playerState.movePlayerBetweenLists('John', 'waitingList', 'available')
            ).toThrow('Player John is not in waiting list.');
        });

        it('should throw error for unregistered player', () => {
            expect(() =>
                playerState.movePlayerBetweenLists('Unknown', 'available', 'waitingList')
            ).toThrow(PlayerError);
            expect(() =>
                playerState.movePlayerBetweenLists('Unknown', 'available', 'waitingList')
            ).toThrow('Player Unknown is not registered.');
        });
    });

    describe('immutability', () => {
        it('should not modify original state when creating new state', () => {
            const originalPlayers = structuredClone(playerState.players);
            const originalTeams = structuredClone(playerState.teams);

            playerState.addPlayer('John');

            expect(playerState.players).toEqual(originalPlayers);
            expect(playerState.teams).toEqual(originalTeams);
        });

        it('should return new instances from all operations', () => {
            playerState.players.available = ['John'];

            const newState1 = playerState.addPlayer('Jane');
            const newState2 = playerState.removePlayer('John');
            const newState3 = playerState.movePlayerToTeam('John', 'Team A');

            expect(newState1).not.toBe(playerState);
            expect(newState2).not.toBe(playerState);
            expect(newState3).not.toBe(playerState);
            expect(newState1).not.toBe(newState2);
            expect(newState2).not.toBe(newState3);
        });
    });

    describe('edge cases', () => {
        it('should handle empty teams object', () => {
            const emptyTeamsState = new PlayerState(mockPlayers, {}, mockSettings);

            expect(() => emptyTeamsState.validateState()).not.toThrow();
            expect(() => emptyTeamsState.addPlayer('John')).not.toThrow();
        });

        it('should handle null values in team rosters', () => {
            playerState.teams['Team A'] = [null, null, null];
            playerState.players.available = ['John'];

            expect(() => playerState.validateState()).not.toThrow();

            const newState = playerState.movePlayerToTeam('John', 'Team A');
            expect(newState.teams['Team A'][0]).toBe('John');
        });

        it('should handle player limit of 0', () => {
            const limitedState = new PlayerState(mockPlayers, mockTeams, { playerLimit: 0 });

            const newState = limitedState.addPlayer('John', 'auto');
            expect(newState.players.waitingList).toContain('John');
            expect(newState.players.available).not.toContain('John');
        });
    });
});
