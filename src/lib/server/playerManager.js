import { data } from './data.js';
import { defaultPlayers } from '$lib/shared/defaults.js';
import { getConsolidatedSettings } from './settings.js';

/**
 * Custom error class for player operations that preserves HTTP status codes
 */
export class PlayerError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'PlayerError';
        this.statusCode = statusCode;
    }
}

/**
 * Immutable state manager for player-team relationships
 * Ensures consistency between players (available/waiting) and team assignments
 */
export class PlayerState {
    constructor(players, teams, settings) {
        this.players = structuredClone(players);
        this.teams = structuredClone(teams);
        this.settings = settings;
    }

    /**
     * Get player's current location/status
     * @param {string} playerName
     * @returns {{ location: 'available'|'waiting'|null, teamName?: string, isAssigned: boolean }}
     */
    getPlayerLocation(playerName) {
        if (this.players.available.includes(playerName)) {
            // Check if assigned to a team
            for (const [teamName, roster] of Object.entries(this.teams)) {
                if (roster.includes(playerName)) {
                    return { location: 'available', teamName, isAssigned: true };
                }
            }
            return { location: 'available', isAssigned: false };
        }

        if (this.players.waitingList.includes(playerName)) {
            return { location: 'waiting', isAssigned: false };
        }

        return { location: null, isAssigned: false }; // Player not found
    }

    /**
     * Validate state consistency
     * @throws {PlayerError} If state is inconsistent
     */
    validateState() {
        // Check for duplicates between available and waiting
        const availableSet = new Set(this.players.available);

        for (const player of this.players.waitingList) {
            if (availableSet.has(player)) {
                throw new PlayerError(
                    `Player ${player} exists in both available and waiting lists`,
                    500
                );
            }
        }

        // Check that all assigned players are in available list
        const assignedPlayers = new Set();
        for (const roster of Object.values(this.teams)) {
            for (const player of roster) {
                if (player !== null) {
                    assignedPlayers.add(player);
                    if (!availableSet.has(player)) {
                        throw new PlayerError(
                            `Assigned player ${player} not in available list`,
                            500
                        );
                    }
                }
            }
        }

        // Check player limit
        if (this.players.available.length > this.settings.playerLimit) {
            throw new PlayerError(
                `Available players exceed limit of ${this.settings.playerLimit}`,
                500
            );
        }
    }

    /**
     * Add player to appropriate list based on player limit and target
     * @param {string} playerName
     * @param {string} targetList - 'auto', 'available', or 'waitingList'
     * @returns {PlayerState} New state
     */
    addPlayer(playerName, targetList = 'auto') {
        const location = this.getPlayerLocation(playerName);
        if (location.location) {
            throw new PlayerError(`Player ${playerName} is already registered.`, 400);
        }

        const newState = new PlayerState(this.players, this.teams, this.settings);

        // Determine actual target list
        let actualTarget = targetList;
        if (targetList === 'auto') {
            actualTarget =
                newState.players.available.length >= this.settings.playerLimit
                    ? 'waitingList'
                    : 'available';
        }

        // Add to appropriate list
        if (actualTarget === 'available') {
            if (newState.players.available.length >= this.settings.playerLimit) {
                // Auto-redirect to waiting list
                newState.players.waitingList.push(playerName);
            } else {
                newState.players.available.push(playerName);
            }
        } else {
            newState.players.waitingList.push(playerName);
        }

        newState.validateState();
        return newState;
    }

    /**
     * Remove player from all lists and teams
     * @param {string} playerName
     * @returns {PlayerState} New state
     */
    removePlayer(playerName) {
        const location = this.getPlayerLocation(playerName);
        if (!location.location) {
            throw new PlayerError(`Player ${playerName} is not registered.`, 400);
        }

        const newState = new PlayerState(this.players, this.teams, this.settings);

        // Remove from player lists
        newState.players.available = newState.players.available.filter((p) => p !== playerName);
        newState.players.waitingList = newState.players.waitingList.filter((p) => p !== playerName);

        // Remove from all teams
        for (const teamName of Object.keys(newState.teams)) {
            newState.teams[teamName] = newState.teams[teamName].map((p) =>
                p === playerName ? null : p
            );
        }

        newState.validateState();
        return newState;
    }

    /**
     * Move player from unassigned/waiting to a specific team
     * @param {string} playerName
     * @param {string} teamName
     * @returns {PlayerState} New state
     */
    movePlayerToTeam(playerName, teamName) {
        const location = this.getPlayerLocation(playerName);
        if (!location.location) {
            throw new PlayerError(`Player ${playerName} is not registered.`, 400);
        }

        if (location.isAssigned) {
            throw new PlayerError(
                `Player ${playerName} is already assigned to team ${location.teamName}.`,
                400
            );
        }

        const newState = new PlayerState(this.players, this.teams, this.settings);

        // Check if team exists
        if (!newState.teams[teamName]) {
            throw new PlayerError(`Team ${teamName} does not exist.`, 400);
        }

        // Find empty slot in team
        const emptySlotIndex = newState.teams[teamName].findIndex((p) => p === null);
        if (emptySlotIndex === -1) {
            throw new PlayerError(`Team ${teamName} has no empty slots.`, 400);
        }

        // Assign to team
        newState.teams[teamName][emptySlotIndex] = playerName;

        // Move from waiting to available if needed
        if (location.location === 'waiting') {
            newState.players.waitingList = newState.players.waitingList.filter(
                (p) => p !== playerName
            );

            // Only add to available if within limit
            if (newState.players.available.length < this.settings.playerLimit) {
                newState.players.available.push(playerName);
            } else {
                throw new PlayerError(`Player limit of ${this.settings.playerLimit} reached.`, 400);
            }
        }

        newState.validateState();
        return newState;
    }

    /**
     * Move player from team to waiting list
     * @param {string} playerName
     * @returns {PlayerState} New state
     */
    movePlayerToWaiting(playerName) {
        const location = this.getPlayerLocation(playerName);
        if (!location.location) {
            throw new PlayerError(`Player ${playerName} is not registered.`, 400);
        }

        if (!location.isAssigned) {
            throw new PlayerError(`Player ${playerName} is not assigned to any team.`, 400);
        }

        const newState = new PlayerState(this.players, this.teams, this.settings);

        // Remove from team
        newState.teams[location.teamName] = newState.teams[location.teamName].map((p) =>
            p === playerName ? null : p
        );

        // Move from available to waiting
        newState.players.available = newState.players.available.filter((p) => p !== playerName);
        if (!newState.players.waitingList.includes(playerName)) {
            newState.players.waitingList.push(playerName);
        }

        newState.validateState();
        return newState;
    }

    /**
     * Move player between available and waiting lists
     * @param {string} playerName
     * @param {string} fromList - 'available' or 'waitingList'
     * @param {string} toList - 'available' or 'waitingList'
     * @returns {PlayerState} New state
     */
    movePlayerBetweenLists(playerName, fromList, toList) {
        if (fromList === toList) {
            return this; // No change needed
        }

        const location = this.getPlayerLocation(playerName);
        if (!location.location) {
            throw new PlayerError(`Player ${playerName} is not registered.`, 400);
        }

        // Validate source list
        if (fromList === 'available' && location.location !== 'available') {
            throw new PlayerError(`Player ${playerName} is not in available list.`, 400);
        }
        if (fromList === 'waitingList' && location.location !== 'waiting') {
            throw new PlayerError(`Player ${playerName} is not in waiting list.`, 400);
        }

        const newState = new PlayerState(this.players, this.teams, this.settings);

        if (toList === 'available') {
            // Moving to available - check limit
            if (newState.players.available.length >= this.settings.playerLimit) {
                throw new PlayerError(`Player limit of ${this.settings.playerLimit} reached.`, 400);
            }

            newState.players.waitingList = newState.players.waitingList.filter(
                (p) => p !== playerName
            );
            if (!newState.players.available.includes(playerName)) {
                newState.players.available.push(playerName);
            }
        } else {
            // Moving to waiting - remove from teams if assigned
            if (location.isAssigned) {
                newState.teams[location.teamName] = newState.teams[location.teamName].map((p) =>
                    p === playerName ? null : p
                );
            }

            newState.players.available = newState.players.available.filter((p) => p !== playerName);
            if (!newState.players.waitingList.includes(playerName)) {
                newState.players.waitingList.push(playerName);
            }
        }

        newState.validateState();
        return newState;
    }
}

export class PlayerManager {
    // Private fields for caching
    #dataCache = null;
    #cacheKey = null; // Tracks what data is cached (date-league combination)

    constructor() {
        this.date = null;
        this.leagueId = null;
    }

    /**
     * Initialize with date for operations
     */
    setDate(date) {
        if (this.date !== date) {
            this.date = date;
            this.#invalidateCache();
        }
        return this;
    }

    /**
     * Initialize with league id for operations
     */
    setLeague(leagueId) {
        if (this.leagueId !== leagueId) {
            this.leagueId = leagueId;
            this.#invalidateCache();
        }
        return this;
    }

    /**
     * Invalidate the data cache when date or league changes
     */
    #invalidateCache() {
        this.#dataCache = null;
        this.#cacheKey = null;
    }

    /**
     * Get current cache key for the date-league combination
     */
    #getCacheKey() {
        return `${this.date}-${this.leagueId}`;
    }

    /**
     * Check if cached data is valid for current date-league combination
     */
    #isCacheValid() {
        return this.#dataCache !== null && this.#cacheKey === this.#getCacheKey();
    }

    /**
     * Execute an atomic transaction on player state
     * @param {function(PlayerState): PlayerState} operation - Function that takes current state and returns new state
     * @returns {Promise<{players: Object, teams: Object}>} - The updated game data
     */
    async executeTransaction(operation) {
        const gameData = await this.getData();
        const { players, teams, settings } = gameData;

        // Create current state
        const currentState = new PlayerState(players, teams, settings);

        // Apply operation to get new state
        const newState = operation(currentState);

        // Validate the new state
        newState.validateState();

        // Determine what needs to be saved
        const playersChanged = JSON.stringify(players) !== JSON.stringify(newState.players);
        const teamsChanged = JSON.stringify(teams) !== JSON.stringify(newState.teams);

        // Save changes atomically using setMany for true atomicity
        const operations = [];

        if (playersChanged) {
            operations.push({
                key: 'players',
                value: newState.players,
                defaultValue: { available: [], waitingList: [] },
                overwrite: true
            });
        }

        if (teamsChanged) {
            operations.push({
                key: 'teams',
                value: newState.teams,
                defaultValue: {},
                overwrite: true
            });
        }

        // Execute all saves in a single atomic operation
        if (operations.length > 0) {
            try {
                await data.setMany(operations, this.date, this.leagueId);
                // Invalidate cache after successful save
                this.#invalidateCache();
            } catch (saveError) {
                // Log the specific save error for debugging
                console.error('Failed to save player/team data atomically:', saveError);

                // Re-throw with context about which operation failed during save
                const errorMessage = `Failed to save changes: ${saveError.message || 'Unknown database error'}`;
                throw new PlayerError(errorMessage, 500);
            }
        }

        return {
            players: newState.players,
            teams: newState.teams
        };
    }

    /**
     * Get game data with selective loading (with caching)
     * @param {Object} options - What data to load
     * @param {boolean} options.players - Load players data (default: true)
     * @param {boolean} options.teams - Load teams data (default: true)
     * @param {boolean} options.settings - Load settings data (default: true)
     */
    async getData(options = { players: true, teams: true, settings: true }) {
        // Return cached data if valid and includes all requested components
        if (this.#isCacheValid()) {
            const result = {};
            if (options.players && this.#dataCache.players) {
                result.players = structuredClone(this.#dataCache.players);
            }
            if (options.teams && this.#dataCache.teams) {
                result.teams = structuredClone(this.#dataCache.teams);
            }
            if (options.settings && this.#dataCache.settings) {
                result.settings = structuredClone(this.#dataCache.settings);
            }

            // If cache satisfies all requested data, return it
            const hasAllRequested =
                (!options.players || result.players !== undefined) &&
                (!options.teams || result.teams !== undefined) &&
                (!options.settings || result.settings !== undefined);

            if (hasAllRequested) {
                return result;
            }
        }

        // Build array of data loading promises based on options
        const loadPromises = [];
        const loadKeys = [];

        if (options.players) {
            loadPromises.push(data.get('players', this.date, this.leagueId));
            loadKeys.push('players');
        }

        if (options.teams) {
            loadPromises.push(data.get('teams', this.date, this.leagueId));
            loadKeys.push('teams');
        }

        if (options.settings) {
            loadPromises.push(getConsolidatedSettings(this.date, this.leagueId));
            loadKeys.push('settings');
        }

        // Load requested data from disk
        const loadedData = await Promise.all(loadPromises);

        // Build result object
        const result = {};

        for (let i = 0; i < loadKeys.length; i++) {
            const key = loadKeys[i];
            const value = loadedData[i];

            if (key === 'players') {
                result.players = value || structuredClone(defaultPlayers);
            } else if (key === 'teams') {
                result.teams = value || {};
            } else if (key === 'settings') {
                // Extract effective settings for this date (day overrides take precedence)
                const consolidatedSettings = value;
                result.settings =
                    this.date && consolidatedSettings[this.date]
                        ? { ...consolidatedSettings, ...consolidatedSettings[this.date] }
                        : consolidatedSettings;
            }
        }

        // Update cache only if we loaded all components (full cache)
        if (options.players && options.teams && options.settings) {
            this.#dataCache = structuredClone(result);
            this.#cacheKey = this.#getCacheKey();
        }

        return result;
    }

    /**
     * Add player to available list or waiting list based on player limit
     */
    async addPlayer(playerName, targetList = 'auto') {
        const result = await this.executeTransaction((state) =>
            state.addPlayer(playerName, targetList)
        );
        return result.players;
    }

    /**
     * Remove player from specified list and from any teams they're assigned to
     */
    async removePlayer(playerName) {
        const result = await this.executeTransaction((state) => state.removePlayer(playerName));
        return result.players;
    }

    /**
     * Move player between available and waiting lists, removing from teams if moving to waiting list
     */
    async movePlayer(playerName, fromList, toList) {
        const result = await this.executeTransaction((state) =>
            state.movePlayerBetweenLists(playerName, fromList, toList)
        );
        return result.players;
    }

    /**
     * Remove player from a specific team and optionally move to waiting list or remove completely
     */
    async removePlayerFromTeam(playerName, teamName, action = 'waitingList') {
        return await this.executeTransaction((state) => {
            const location = state.getPlayerLocation(playerName);
            if (!location.location) {
                throw new PlayerError(`Player ${playerName} is not registered.`, 400);
            }

            if (!location.isAssigned || location.teamName !== teamName) {
                throw new PlayerError(
                    `Player ${playerName} is not assigned to team ${teamName}.`,
                    400
                );
            }

            const newState = new PlayerState(state.players, state.teams, state.settings);

            // Remove from team
            newState.teams[teamName] = newState.teams[teamName].map((p) =>
                p === playerName ? null : p
            );

            // Handle the action
            if (action === 'waitingList') {
                // Move to waiting list
                newState.players.available = newState.players.available.filter(
                    (p) => p !== playerName
                );
                if (!newState.players.waitingList.includes(playerName)) {
                    newState.players.waitingList.push(playerName);
                }
            } else if (action === 'unassign') {
                // Keep in available list (already there, just remove from team)
            } else if (action === 'remove') {
                // Remove completely
                newState.players.available = newState.players.available.filter(
                    (p) => p !== playerName
                );
                newState.players.waitingList = newState.players.waitingList.filter(
                    (p) => p !== playerName
                );
            }

            newState.validateState();
            return newState;
        });
    }

    /**
     * Fill empty team slot with specific player from waiting list or available list
     */
    async fillEmptySlotWithPlayer(teamName, playerName) {
        return await this.executeTransaction((state) =>
            state.movePlayerToTeam(playerName, teamName)
        );
    }

    /**
     * Get available empty slots across all teams
     */
    async getAvailableSlots() {
        const gameData = await this.getData({ players: false, teams: true, settings: false });
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
     * Validate and clean up inconsistencies between players and teams
     */
    async validateAndCleanup() {
        return await this.executeTransaction((state) => {
            const newState = new PlayerState(state.players, state.teams, state.settings);
            let hasChanges = false;

            // Get all players in teams
            const playersInTeams = new Set();
            Object.values(newState.teams).forEach((roster) => {
                roster.forEach((player) => {
                    if (player !== null) {
                        playersInTeams.add(player);
                    }
                });
            });

            // Check if any team players are not in available list
            for (const teamPlayer of playersInTeams) {
                if (!newState.players.available.includes(teamPlayer)) {
                    newState.players.available.push(teamPlayer);
                    hasChanges = true;
                }
            }

            // Only return new state if changes were made
            if (hasChanges) {
                newState.validateState();
                return newState;
            }

            return state; // No changes needed
        });
    }
}

// Export factory function to create new instance per request
export const createPlayerManager = () => new PlayerManager();
