import { data } from './data.js';
import { defaultSettings, defaultPlayers } from '$lib/shared/defaults.js';

export class PlayerManager {
    constructor() {
        this.date = null;
    }

    /**
     * Initialize with date for operations
     */
    setDate(date) {
        this.date = date;
        return this;
    }

    /**
     * Get current players and teams data
     */
    async getData() {
        const [players, teams, settings] = await Promise.all([
            data.get('players', this.date),
            data.get('teams', this.date),
            data.get('settings', this.date)
        ]);

        return {
            players: players || defaultPlayers,
            teams: teams || {},
            settings: settings || defaultSettings
        };
    }

    /**
     * Add player to available list or waiting list based on player limit
     */
    async addPlayer(playerName, targetList = 'auto') {
        const gameData = await this.getData();
        const { players, settings } = gameData;

        // Check for duplicates
        if (players.available.includes(playerName) || players.waitingList.includes(playerName)) {
            throw new Error(`Player ${playerName} is already registered.`);
        }

        if (targetList === 'auto') {
            targetList =
                players.available.length >= settings.playerLimit ? 'waitingList' : 'available';
        }

        if (targetList === 'available') {
            if (players.available.length >= settings.playerLimit) {
                // Auto-redirect to waiting list when active list is full
                players.waitingList.push(playerName);
            } else {
                players.available.push(playerName);
            }
        } else if (targetList === 'waitingList') {
            players.waitingList.push(playerName);
        }

        await data.set('players', this.date, players, { available: [], waitingList: [] }, true);
        return players;
    }

    /**
     * Remove player from specified list
     */
    async removePlayer(playerName, fromList) {
        const gameData = await this.getData();
        const { players } = gameData;

        if (fromList === 'available') {
            players.available = players.available.filter((p) => p !== playerName);
        } else if (fromList === 'waitingList') {
            players.waitingList = players.waitingList.filter((p) => p !== playerName);
        }

        await data.set('players', this.date, players, { available: [], waitingList: [] }, true);
        return players;
    }

    /**
     * Move player between available and waiting lists
     */
    async movePlayer(playerName, fromList, toList) {
        const gameData = await this.getData();
        const { players, settings } = gameData;

        // Validate player exists in source list
        if (fromList === 'available' && !players.available.includes(playerName)) {
            throw new Error(`Player ${playerName} is not in available list.`);
        }
        if (fromList === 'waitingList' && !players.waitingList.includes(playerName)) {
            throw new Error(`Player ${playerName} is not in waiting list.`);
        }

        // Remove from source list
        if (fromList === 'available') {
            players.available = players.available.filter((p) => p !== playerName);
        } else if (fromList === 'waitingList') {
            players.waitingList = players.waitingList.filter((p) => p !== playerName);
        }

        // Add to target list
        if (toList === 'available') {
            if (players.available.length >= settings.playerLimit) {
                throw new Error(`Player limit of ${settings.playerLimit} reached.`);
            }
            players.available.push(playerName);
        } else if (toList === 'waitingList') {
            players.waitingList.push(playerName);
        }

        await data.set('players', this.date, players, { available: [], waitingList: [] }, true);
        return players;
    }

    /**
     * Remove player from a specific team and optionally move to waiting list or remove completely
     */
    async removePlayerFromTeam(playerName, teamName, action = 'waitingList') {
        const gameData = await this.getData();
        const { players, teams } = gameData;

        // Remove from team
        if (teams[teamName]) {
            teams[teamName] = teams[teamName].map((p) => (p === playerName ? null : p));
        }

        // Handle the action
        if (action === 'waitingList') {
            // Move to waiting list
            players.available = players.available.filter((p) => p !== playerName);
            if (!players.waitingList.includes(playerName)) {
                players.waitingList.push(playerName);
            }
        } else if (action === 'unassign') {
            // Keep in available list but remove from team (becomes unassigned)
            if (!players.available.includes(playerName)) {
                players.available.push(playerName);
            }
            // Remove from waiting list if present
            players.waitingList = players.waitingList.filter((p) => p !== playerName);
        } else if (action === 'remove') {
            // Remove completely
            players.available = players.available.filter((p) => p !== playerName);
            players.waitingList = players.waitingList.filter((p) => p !== playerName);
        }

        // Save both players and teams
        await Promise.all([
            data.set('players', this.date, players, { available: [], waitingList: [] }, true),
            data.set('teams', this.date, teams, {}, true)
        ]);

        return { players, teams };
    }

    /**
     * Move player from waiting list to a specific team
     */
    async movePlayerFromWaitingToTeam(playerName, teamName) {
        const gameData = await this.getData();
        const { players, teams, settings } = gameData;

        // Check if player is in waiting list
        if (!players.waitingList.includes(playerName)) {
            throw new Error(`Player ${playerName} is not in waiting list.`);
        }

        // Check if team exists
        if (!teams[teamName]) {
            throw new Error(`Team ${teamName} does not exist.`);
        }

        // Find empty slot in team
        const emptySlotIndex = teams[teamName].findIndex((p) => p === null);
        if (emptySlotIndex === -1) {
            throw new Error(`Team ${teamName} has no empty slots.`);
        }

        // Move player
        teams[teamName][emptySlotIndex] = playerName;
        players.waitingList = players.waitingList.filter((p) => p !== playerName);

        // Add to available list if not already there and within limit
        if (
            !players.available.includes(playerName) &&
            players.available.length < settings.playerLimit
        ) {
            players.available.push(playerName);
        }

        // Save both players and teams
        await Promise.all([
            data.set('players', this.date, players, { available: [], waitingList: [] }, true),
            data.set('teams', this.date, teams, {}, true)
        ]);

        return { players, teams };
    }

    /**
     * Fill empty team slot with specific player from waiting list or available list
     */
    async fillEmptySlotWithPlayer(teamName, playerName) {
        const gameData = await this.getData();
        const { players, teams } = gameData;

        // Check if player is in waiting list or available list
        if (!players.waitingList.includes(playerName) && !players.available.includes(playerName)) {
            throw new Error(`Player ${playerName} is not available for assignment.`);
        }

        // Check if team exists
        if (!teams[teamName]) {
            throw new Error(`Team ${teamName} does not exist.`);
        }

        // Find empty slot in team
        const emptySlotIndex = teams[teamName].findIndex((p) => p === null);
        if (emptySlotIndex === -1) {
            throw new Error(`Team ${teamName} has no empty slots.`);
        }

        // Fill slot
        teams[teamName][emptySlotIndex] = playerName;

        // Remove from waiting list if present
        players.waitingList = players.waitingList.filter((p) => p !== playerName);

        // Ensure player is in available list (they should be if they're assigned to a team)
        if (!players.available.includes(playerName)) {
            players.available.push(playerName);
        }

        // Save both players and teams
        await Promise.all([
            data.set('players', this.date, players, { available: [], waitingList: [] }, true),
            data.set('teams', this.date, teams, {}, true)
        ]);

        return { players, teams };
    }

    /**
     * Get available empty slots across all teams
     */
    async getAvailableSlots() {
        const gameData = await this.getData();
        const { teams } = gameData;

        const availableSlots = [];

        Object.entries(teams).forEach(([teamName, roster]) => {
            const emptySlots = roster
                .map((player, index) => ({ player, index }))
                .filter((slot) => slot.player === null)
                .map((slot) => ({ teamName, slotIndex: slot.index }));

            availableSlots.push(...emptySlots);
        });

        return availableSlots;
    }

    /**
     * Move player between teams
     */
    async movePlayerBetweenTeams(playerName, fromTeam, toTeam) {
        const gameData = await this.getData();
        const { teams } = gameData;

        // Check if teams exist
        if (!teams[fromTeam] || !teams[toTeam]) {
            throw new Error('Both teams must exist.');
        }

        // Check if player is in source team
        const fromIndex = teams[fromTeam].findIndex((p) => p === playerName);
        if (fromIndex === -1) {
            throw new Error(`Player ${playerName} is not in team ${fromTeam}.`);
        }

        // Check if target team has empty slot
        const toIndex = teams[toTeam].findIndex((p) => p === null);
        if (toIndex === -1) {
            throw new Error(`Team ${toTeam} has no empty slots.`);
        }

        // Move player
        teams[fromTeam][fromIndex] = null;
        teams[toTeam][toIndex] = playerName;

        await data.set('teams', this.date, teams, {}, true);
        return teams;
    }

    /**
     * Add player directly to available list after teams are generated
     */
    async addPlayerToAvailable(playerName) {
        const gameData = await this.getData();
        const { players, settings } = gameData;

        if (players.available.includes(playerName)) {
            throw new Error(`Player ${playerName} is already in available list.`);
        }

        if (players.available.length >= settings.playerLimit) {
            throw new Error(
                `Player limit of ${settings.playerLimit} reached. Use waiting list instead.`
            );
        }

        // Remove from waiting list if present
        players.waitingList = players.waitingList.filter((p) => p !== playerName);
        players.available.push(playerName);

        await data.set('players', this.date, players, { available: [], waitingList: [] }, true);
        return players;
    }

    /**
     * Validate and clean up inconsistencies between players and teams
     */
    async validateAndCleanup() {
        const gameData = await this.getData();
        const { players, teams } = gameData;

        let hasChanges = false;

        // Get all players in teams
        const playersInTeams = new Set();
        Object.values(teams).forEach((roster) => {
            roster.forEach((player) => {
                if (player !== null) {
                    playersInTeams.add(player);
                }
            });
        });

        // Check if any team players are not in available list
        for (const teamPlayer of playersInTeams) {
            if (!players.available.includes(teamPlayer)) {
                players.available.push(teamPlayer);
                hasChanges = true;
            }
        }

        // Save if changes were made
        if (hasChanges) {
            await data.set('players', this.date, players, { available: [], waitingList: [] }, true);
        }

        return { players, teams, hasChanges };
    }
}

// Export singleton instance
export const playerManager = new PlayerManager();
