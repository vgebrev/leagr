import { data } from './data.js';
import { defaultPlayers } from '$lib/shared/defaults.js';
import { getConsolidatedSettings } from './settings.js';
import { createRankingsManager } from './rankings.js';
import { createAvatarManager } from './avatarManager.js';

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
     * Get a player's current location/status
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
                    400
                );
            }
        }

        // Check that all assigned players are in the available list
        const assignedPlayers = new Set();
        for (const roster of Object.values(this.teams)) {
            for (const player of roster) {
                if (player !== null) {
                    assignedPlayers.add(player);
                    if (!availableSet.has(player)) {
                        throw new PlayerError(
                            `Assigned player ${player} not in available list`,
                            400
                        );
                    }
                }
            }
        }

        // Check player limit
        if (this.players.available.length > this.settings.playerLimit) {
            throw new PlayerError(
                `Available players exceed limit of ${this.settings.playerLimit}`,
                400
            );
        }
    }

    /**
     * Add player to the appropriate list based on player limit and target
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

        // Determine the actual target list
        let actualTarget = targetList;
        if (targetList === 'auto') {
            actualTarget =
                newState.players.available.length >= this.settings.playerLimit
                    ? 'waitingList'
                    : 'available';
        }

        // Add to the appropriate list
        if (actualTarget === 'available') {
            if (newState.players.available.length >= this.settings.playerLimit) {
                // Auto-redirect to the waiting list
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
     * Move a player from unassigned/waiting to a specific team
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

        // Check if the team exists
        if (!newState.teams[teamName]) {
            throw new PlayerError(`Team ${teamName} does not exist.`, 400);
        }

        // Find an empty slot in the team
        const emptySlotIndex = newState.teams[teamName].findIndex((p) => p === null);

        if (emptySlotIndex === -1) {
            // No null slots available, check if team is below max capacity
            const currentPlayerCount = newState.teams[teamName].filter((p) => p !== null).length;
            const maxPlayersPerTeam = this.settings.teamGeneration?.maxPlayersPerTeam || 7;

            if (currentPlayerCount >= maxPlayersPerTeam) {
                throw new PlayerError(
                    `Team ${teamName} has reached maximum capacity of ${maxPlayersPerTeam} players.`,
                    400
                );
            }

            // Team has space, add player to the end
            newState.teams[teamName].push(playerName);
        } else {
            // Assign to existing empty slot
            newState.teams[teamName][emptySlotIndex] = playerName;
        }

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

        // Remove from the team
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

    /**
     * Rename a player in all lists and teams
     * @param {string} oldName - Current player name
     * @param {string} newName - New player name
     * @returns {PlayerState} New state
     */
    renamePlayer(oldName, newName) {
        const location = this.getPlayerLocation(oldName);
        if (!location.location) {
            throw new PlayerError(`Player ${oldName} is not registered.`, 400);
        }

        // Check if new name already exists
        const newNameLocation = this.getPlayerLocation(newName);
        if (newNameLocation.location) {
            throw new PlayerError(`Player ${newName} is already registered.`, 400);
        }

        const newState = new PlayerState(this.players, this.teams, this.settings);

        // Update in available list
        const availableIndex = newState.players.available.indexOf(oldName);
        if (availableIndex !== -1) {
            newState.players.available[availableIndex] = newName;
        }

        // Update in waiting list
        const waitingIndex = newState.players.waitingList.indexOf(oldName);
        if (waitingIndex !== -1) {
            newState.players.waitingList[waitingIndex] = newName;
        }

        // Update in all teams
        for (const teamName of Object.keys(newState.teams)) {
            newState.teams[teamName] = newState.teams[teamName].map((p) =>
                p === oldName ? newName : p
            );
        }

        newState.validateState();
        return newState;
    }
}

export class PlayerManager {
    // Private fields for caching
    #dataCache = null;
    #cacheKey = null; // Tracks what data is cached (date-league combination)
    #owners = null; // { [playerName]: ownerId }
    #ownersDirty = false;
    #accessControl = null;

    constructor() {
        this.date = null;
        this.leagueId = null;
    }

    /**
     * Initialise with a date for operations
     */
    setDate(date) {
        if (this.date !== date) {
            this.date = date;
            this.#invalidateCache();
        }
        return this;
    }

    /**
     * Initialise with league id for operations
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
     * Get the current cache key for the date-league combination
     */
    #getCacheKey() {
        return `${this.date}-${this.leagueId}`;
    }

    /**
     * Check if cached data is valid for the current date-league combination
     */
    #isCacheValid() {
        return this.#dataCache !== null && this.#cacheKey === this.#getCacheKey();
    }

    /**
     * Attach access control for ownership enforcement
     * @param {import('./playerAccessControl.js').PlayerAccessControl} access
     */
    setAccessControl(access) {
        this.#accessControl = access;
        return this;
    }

    /**
     * Returns the list of players owned by the current client (based on access control).
     * @returns {Promise<string[]>}
     */
    async getOwnedPlayersForCurrentClient() {
        if (!this.#accessControl) return [];
        await this.#loadOwners();
        const myOwnerId = this.#accessControl.deriveOwnerId();
        if (!myOwnerId || !this.#owners) return [];
        return Object.keys(this.#owners).filter((p) => this.#owners[p] === myOwnerId);
    }

    async #loadOwners() {
        if (this.#owners === null) {
            this.#owners = (await data.get('playerOwners', this.date, this.leagueId)) || {};
        }
        return this.#owners;
    }

    #setOwnerIfAbsentSync(playerName) {
        if (!this.#accessControl) return;
        if (!this.#owners) this.#owners = {};
        if (!this.#owners[playerName]) {
            const oid = this.#accessControl.deriveOwnerId();
            if (oid) {
                this.#owners[playerName] = oid;
                this.#ownersDirty = true;
            }
        }
    }

    #deleteOwnerSync(playerName) {
        if (!this.#owners) return;
        if (this.#owners[playerName]) {
            delete this.#owners[playerName];
            this.#ownersDirty = true;
        }
    }

    #ensureOwnerOrAdminSync(playerName) {
        if (!this.#accessControl) return; // no enforcement without access control
        const ownerId = this.#owners?.[playerName];
        const allowed = this.#accessControl.isOwner(ownerId);
        if (!allowed) {
            // Use 401 so client does not clear league access on 403
            throw new PlayerError('You are not allowed to modify this player.', 401);
        }
    }

    /**
     * Execute an atomic transaction on player state
     * @param {function(PlayerState): PlayerState} operation - Function that takes current state and returns new state
     * @returns {Promise<{players: Object, teams: Object}>} - The updated game data
     */
    async executeTransaction(operation) {
        const gameData = await this.getData();
        const { players, teams, settings } = gameData;

        // Create the current state
        const currentState = new PlayerState(players, teams, settings);

        // Ensure owners mapping is available only when access control is enabled
        if (this.#accessControl) {
            await this.#loadOwners();
        }

        // Apply operation to get the new state
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

        if (this.#ownersDirty) {
            operations.push({
                key: 'playerOwners',
                value: this.#owners,
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
                this.#ownersDirty = false;
            } catch (saveError) {
                // Log the specific save error for debugging
                console.error('Failed to save player/team data atomically:', saveError);

                // Re-throw the original error to preserve its type and status code
                throw saveError;
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

            // If the cache satisfies all requested data, return it
            const hasAllRequested =
                (!options.players || result.players !== undefined) &&
                (!options.teams || result.teams !== undefined) &&
                (!options.settings || result.settings !== undefined);

            if (hasAllRequested) {
                return result;
            }
        }

        // Build an array of data loading promises based on options
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
     * Calculate provisional rating using linear interpolation from anchor to actual
     * @param {number} actualRating - The player's actual rating
     * @param {number} gamesPlayed - Number of games the player has played (ELO games)
     * @param {number} anchorValue - The starting anchor value
     * @param {number} threshold - Games played before rating is fully trusted
     * @returns {number} - Provisional rating
     */
    #calculateProvisionalRating(actualRating, gamesPlayed, anchorValue, threshold) {
        if (gamesPlayed >= threshold) return actualRating;
        const pullFactor = gamesPlayed / threshold;
        return anchorValue + (actualRating - anchorValue) * pullFactor;
    }

    /**
     * Calculate provisional anchor values from established players in the session.
     * Uses weakest established player's rating × 0.99 as anchor.
     * @param {string[]} sessionPlayers - List of player names in this session
     * @param {Object} rankings - Enhanced rankings data
     * @param {number} threshold - Games played threshold for established status
     * @returns {{elo: number, attack: number, control: number}}
     */
    #calculateProvisionalAnchors(sessionPlayers, rankings, previousYearRankings, threshold) {
        const DEFAULT_ELO = 1000;
        const DEFAULT_RATING = 0.5;

        if (!rankings?.players || !sessionPlayers?.length) {
            return { elo: DEFAULT_ELO, attack: DEFAULT_RATING, control: DEFAULT_RATING };
        }

        // Find the weakest established player IN THIS SESSION
        // Use the same lookup logic as individual player enhancement (last detail before session)
        let weakestElo = null;
        let weakestAttack = null;
        let weakestControl = null;

        for (const playerName of sessionPlayers) {
            // Try current year first, fall back to previous year for carry-over
            let playerData = rankings.players[playerName];
            let usedPreviousYear = false;
            if (!playerData && previousYearRankings?.players?.[playerName]) {
                playerData = previousYearRankings.players[playerName];
                usedPreviousYear = true;
            }
            if (!playerData) continue;

            let gamesPlayed = 0;
            let elo = DEFAULT_ELO;
            let attack = DEFAULT_RATING;
            let control = DEFAULT_RATING;

            // If using previous year data, use the top-level snapshot (no detail lookup needed)
            if (usedPreviousYear) {
                gamesPlayed = playerData.elo?.gamesPlayed ?? 0;
                elo = playerData.elo?.rating ?? DEFAULT_ELO;
                attack = playerData.attackingRating ?? DEFAULT_RATING;
                control = playerData.controlRating ?? DEFAULT_RATING;
            } else {
                // Current year: Find the last ranking detail entry before this session date
                let lastDetailBeforeSession = null;
                if (playerData.rankingDetail) {
                    const detailDates = Object.keys(playerData.rankingDetail).sort();
                    for (const date of detailDates) {
                        if (date < this.date) {
                            lastDetailBeforeSession = playerData.rankingDetail[date];
                        } else {
                            break;
                        }
                    }
                }

                if (lastDetailBeforeSession) {
                    gamesPlayed = lastDetailBeforeSession.eloGames ?? 0;
                    elo = lastDetailBeforeSession.eloRating ?? DEFAULT_ELO;
                    attack = lastDetailBeforeSession.attackingRating ?? DEFAULT_RATING;
                    control = lastDetailBeforeSession.controlRating ?? DEFAULT_RATING;
                } else if (previousYearRankings?.players?.[playerName]) {
                    // No detail found in current year before session - fall back to previous year
                    const prevYearPlayer = previousYearRankings.players[playerName];
                    gamesPlayed = prevYearPlayer.elo?.gamesPlayed ?? 0;
                    elo = prevYearPlayer.elo?.rating ?? DEFAULT_ELO;
                    attack = prevYearPlayer.attackingRating ?? DEFAULT_RATING;
                    control = prevYearPlayer.controlRating ?? DEFAULT_RATING;
                }
                // else: no data found - use defaults (already initialized above)
            }

            // Check if player is established (based on pre-session games count)
            if (gamesPlayed >= threshold) {
                if (weakestElo === null || elo < weakestElo) weakestElo = elo;
                if (weakestAttack === null || attack < weakestAttack) weakestAttack = attack;
                if (weakestControl === null || control < weakestControl) weakestControl = control;
            }
        }

        // If no established players in session, use defaults
        if (weakestElo === null) {
            return { elo: DEFAULT_ELO, attack: DEFAULT_RATING, control: DEFAULT_RATING };
        }

        return {
            elo: weakestElo * 0.99,
            attack: weakestAttack * 0.99,
            control: weakestControl * 0.99
        };
    }

    /**
     * Helper method to enhance player list with ELO and avatar data.
     * Returns provisional ratings for players with < 35 games played.
     * @param {string[]} players - Array of player names (can include null values for teams)
     * @param {Object} rankings - Enhanced rankings data (current year)
     * @param {Object} previousYearRankings - Rankings from previous year (for carry-over lookup)
     * @param {Object} avatars - Avatar data from avatarManager
     * @param {{elo: number, attack: number, control: number}} anchors - Pre-calculated anchor values
     * @returns {Object[]} Array of player objects with name, elo, avatar, isProvisional (preserving nulls)
     */
    #enhancePlayersWithEloAndAvatar(players, rankings, previousYearRankings, avatars, anchors) {
        const GAMES_THRESHOLD = 35; // Games played before rating is fully trusted (~5 sessions)
        const DEFAULT_ELO = 1000;
        const DEFAULT_RATING = 0.5;

        return players.map((playerName) => {
            if (playerName === null) {
                return null; // Preserve null slots for teams
            }

            // Get ELO and ratings from last ranking detail BEFORE this session
            const playerRanking = rankings.players?.[playerName];
            let actualElo = DEFAULT_ELO;
            let attackingRating = DEFAULT_RATING;
            let controlRating = DEFAULT_RATING;
            let gamesPlayed = 0;

            // Find the last ranking detail entry before this session date
            let lastDetailBeforeSession = null;
            if (playerRanking?.rankingDetail) {
                const detailDates = Object.keys(playerRanking.rankingDetail).sort();
                for (const date of detailDates) {
                    if (date < this.date) {
                        lastDetailBeforeSession = playerRanking.rankingDetail[date];
                    } else {
                        break; // Stop at or after session date
                    }
                }
            }

            if (lastDetailBeforeSession) {
                // Use values from the last detail before this session
                actualElo = lastDetailBeforeSession.eloRating ?? DEFAULT_ELO;
                gamesPlayed = lastDetailBeforeSession.eloGames ?? 0;
                attackingRating = lastDetailBeforeSession.attackingRating ?? DEFAULT_RATING;
                controlRating = lastDetailBeforeSession.controlRating ?? DEFAULT_RATING;
            } else if (previousYearRankings?.players?.[playerName]) {
                // No detail before session - player hasn't played yet this year (or year boundary case)
                // Fall back to previous year end-of-year state
                const prevYearPlayer = previousYearRankings.players[playerName];
                actualElo = prevYearPlayer.elo?.rating ?? DEFAULT_ELO;
                gamesPlayed = prevYearPlayer.elo?.gamesPlayed ?? 0;
                attackingRating = prevYearPlayer.attackingRating ?? DEFAULT_RATING;
                controlRating = prevYearPlayer.controlRating ?? DEFAULT_RATING;
            }
            // else: player is completely new (no current or previous year data) - use defaults

            // Get avatar data
            const playerAvatar = avatars?.[playerName];
            const avatar = playerAvatar?.avatar || null;

            // Determine if player is provisional (less than threshold games)
            const appearances = playerRanking?.appearances ?? 0;
            const isProvisional = gamesPlayed < GAMES_THRESHOLD;

            // Calculate provisional ratings (established players get their actual ratings)
            const provisionalElo = Math.round(
                this.#calculateProvisionalRating(
                    actualElo,
                    gamesPlayed,
                    anchors.elo,
                    GAMES_THRESHOLD
                )
            );
            const provisionalAttack = this.#calculateProvisionalRating(
                attackingRating,
                gamesPlayed,
                anchors.attack,
                GAMES_THRESHOLD
            );
            const provisionalControl = this.#calculateProvisionalRating(
                controlRating,
                gamesPlayed,
                anchors.control,
                GAMES_THRESHOLD
            );

            return {
                name: playerName,
                elo: provisionalElo,
                actualElo: Math.round(actualElo),
                avatar,
                attackingRating: provisionalAttack,
                controlRating: provisionalControl,
                isProvisional,
                appearances
            };
        });
    }

    /**
     * Get teams data enhanced with player ELO and avatar information
     * @returns {Promise<Object>} Teams object with player objects containing name, elo, and avatar
     */
    async getTeamsWithElo() {
        // Get basic teams data
        const gameData = await this.getData({ players: false, teams: true, settings: false });

        const rankingsManager = createRankingsManager().setLeague(this.leagueId);

        // Extract year from session date to load correct year's rankings
        const currentYear = new Date(this.date).getFullYear();
        const previousYear = currentYear - 1;

        // Load rankings for current year (with fallback to previous year if empty)
        const rankings = await rankingsManager.loadEnhancedRankings(currentYear, {
            fallbackToPreviousYear: true
        });

        // Load previous year rankings for carry-over lookups
        const previousYearRankings = await rankingsManager.loadEnhancedRankings(previousYear);

        // Load avatar data
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        // Collect all unique players from teams (for session-based anchor calculation)
        const sessionPlayers = new Set();
        for (const players of Object.values(gameData.teams)) {
            for (const player of players) {
                if (player !== null) {
                    sessionPlayers.add(player);
                }
            }
        }

        // Calculate anchors from session players
        const anchors = this.#calculateProvisionalAnchors(
            Array.from(sessionPlayers),
            rankings,
            previousYearRankings,
            35
        );

        // Enhance teams with ELO and avatar data using the helper method
        const enhancedTeams = {};
        for (const [teamName, players] of Object.entries(gameData.teams)) {
            enhancedTeams[teamName] = this.#enhancePlayersWithEloAndAvatar(
                players,
                rankings,
                previousYearRankings,
                avatars,
                anchors
            );
        }

        return enhancedTeams;
    }

    /**
     * Get all data enhanced with player ELO and avatar information for team management UI
     * @returns {Promise<{teams: Object, players: {available: Object[], waitingList: Object[]}}>}
     */
    async getAllDataWithElo() {
        // Get basic game data
        const gameData = await this.getData({ players: true, teams: true, settings: false });

        const rankingsManager = createRankingsManager().setLeague(this.leagueId);

        // Extract year from session date to load correct year's rankings
        const currentYear = new Date(this.date).getFullYear();
        const previousYear = currentYear - 1;

        // Load rankings for current year (with fallback to previous year if empty)
        const rankings = await rankingsManager.loadEnhancedRankings(currentYear, {
            fallbackToPreviousYear: true
        });

        // Load previous year rankings for carry-over lookups
        const previousYearRankings = await rankingsManager.loadEnhancedRankings(previousYear);

        // Load avatar data
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        // Collect all session players (available + waitingList) for anchor calculation
        const sessionPlayers = [...gameData.players.available, ...gameData.players.waitingList];

        // Calculate anchors from session players
        const anchors = this.#calculateProvisionalAnchors(
            sessionPlayers,
            rankings,
            previousYearRankings,
            35
        );

        // Enhance teams with ELO and avatar data using the helper method
        const enhancedTeams = {};
        for (const [teamName, players] of Object.entries(gameData.teams)) {
            enhancedTeams[teamName] = this.#enhancePlayersWithEloAndAvatar(
                players,
                rankings,
                previousYearRankings,
                avatars,
                anchors
            );
        }

        // Enhance available and waiting list players with ELO and avatar data
        const enhancedPlayers = {
            available: this.#enhancePlayersWithEloAndAvatar(
                gameData.players.available,
                rankings,
                previousYearRankings,
                avatars,
                anchors
            ),
            waitingList: this.#enhancePlayersWithEloAndAvatar(
                gameData.players.waitingList,
                rankings,
                previousYearRankings,
                avatars,
                anchors
            )
        };

        return {
            teams: enhancedTeams,
            players: enhancedPlayers
        };
    }

    /**
     * Add player to available list or waiting list based on the player limit
     */
    async addPlayer(playerName, targetList = 'auto') {
        const result = await this.executeTransaction((state) => {
            const ns = state.addPlayer(playerName, targetList);
            // Set ownership for newly added player
            this.#setOwnerIfAbsentSync(playerName);
            return ns;
        });
        return result.players;
    }

    /**
     * Remove a player from the lists and from any teams they're assigned to
     */
    async removePlayer(playerName) {
        return await this.executeTransaction((state) => {
            // Enforce ownership when removing completely
            this.#ensureOwnerOrAdminSync(playerName);
            const ns = state.removePlayer(playerName);
            // Remove owner mapping after complete removal
            this.#deleteOwnerSync(playerName);
            return ns;
        });
    }

    /**
     * Move a player between available and waiting lists, removing from teams if moving to the waiting list
     */
    async movePlayer(playerName, fromList, toList) {
        const result = await this.executeTransaction((state) => {
            // Enforce ownership for list moves (prevents freeing spots by others)
            this.#ensureOwnerOrAdminSync(playerName);
            return state.movePlayerBetweenLists(playerName, fromList, toList);
        });
        return result.players;
    }

    /**
     * Rename a player in all lists and teams
     */
    async renamePlayer(oldName, newName) {
        const result = await this.executeTransaction((state) => {
            // Enforce ownership for renaming
            this.#ensureOwnerOrAdminSync(oldName);

            // Perform the rename in state
            const newState = state.renamePlayer(oldName, newName);

            // Update ownership mapping
            if (this.#owners && this.#owners[oldName]) {
                this.#owners[newName] = this.#owners[oldName];
                delete this.#owners[oldName];
                this.#ownersDirty = true;
            }

            return newState;
        });
        return result.players;
    }

    /**
     * Remove a player from a specific team and optionally move to waiting list or remove completely
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

            // Enforce ownership for removals from teams
            this.#ensureOwnerOrAdminSync(playerName);

            const newState = new PlayerState(state.players, state.teams, state.settings);

            // Remove from the team
            newState.teams[teamName] = newState.teams[teamName].map((p) =>
                p === playerName ? null : p
            );

            // Handle the action
            if (action === 'waitingList') {
                // Move to the waiting list
                newState.players.available = newState.players.available.filter(
                    (p) => p !== playerName
                );
                if (!newState.players.waitingList.includes(playerName)) {
                    newState.players.waitingList.push(playerName);
                }
            } else if (action === 'unassign') {
                // Keep in the available list (already there, just remove from the team)
            } else if (action === 'remove') {
                // Remove completely
                newState.players.available = newState.players.available.filter(
                    (p) => p !== playerName
                );
                newState.players.waitingList = newState.players.waitingList.filter(
                    (p) => p !== playerName
                );
                this.#deleteOwnerSync(playerName);
            }

            newState.validateState();
            return newState;
        });
    }

    /**
     * Fill empty team slot with specific player from the waiting list or available list
     */
    async fillEmptySlotWithPlayer(teamName, playerName) {
        return await this.executeTransaction((state) =>
            state.movePlayerToTeam(playerName, teamName)
        );
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

            // Check if any team players are not in the available list
            for (const teamPlayer of playersInTeams) {
                if (!newState.players.available.includes(teamPlayer)) {
                    newState.players.available.push(teamPlayer);
                    hasChanges = true;
                }
            }

            // Only return the new state if changes were made
            if (hasChanges) {
                newState.validateState();
                return newState;
            }

            return state; // No changes needed
        });
    }
}

// Export factory function to create a new instance per request
export const createPlayerManager = () => new PlayerManager();
