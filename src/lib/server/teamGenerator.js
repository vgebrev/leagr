import { nouns } from '$lib/shared/nouns.js';
import { teamColours } from '$lib/shared/helpers.js';

/**
 * Team generation error class
 */
export class TeamError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'TeamError';
        this.statusCode = statusCode;
    }
}

/**
 * Server-side team generation service
 */
export class TeamGenerator {
    constructor() {
        this.settings = null;
        this.players = [];
        this.rankings = null;
        this.recordHistory = false;
        this.drawHistory = [];
        this.initialPots = [];
    }

    /**
     * Set the settings for team generation
     * @param {Object} settings - Team generation settings
     * @returns {TeamGenerator} - Fluent interface
     */
    setSettings(settings) {
        this.settings = settings;
        return this;
    }

    /**
     * Set the available players
     * @param {Array} players - Array of player names
     * @returns {TeamGenerator} - Fluent interface
     */
    setPlayers(players) {
        this.players = players;
        return this;
    }

    /**
     * Set the player rankings
     * @param {Object} rankings - Player rankings data
     * @returns {TeamGenerator} - Fluent interface
     */
    setRankings(rankings) {
        this.rankings = rankings;
        return this;
    }

    /**
     * Enable history recording for replay functionality
     * @param {boolean} enabled - Whether to record draw history
     * @returns {TeamGenerator} - Fluent interface
     */
    setHistoryRecording(enabled) {
        this.recordHistory = enabled;
        this.drawHistory = [];
        this.initialPots = [];
        return this;
    }

    /**
     * Calculate possible team configurations based on player count and settings
     * @param {?number} playerCount - Number of players available (optional, uses set players if not provided)
     * @returns {Array} Array of possible team configurations
     */
    calculateConfigurations(playerCount = null) {
        const count = playerCount || this.players.length;

        if (!this.settings) {
            throw new TeamError('Settings must be set before calculating configurations', 400);
        }

        const teamLimits = {
            min: this.settings.teamGeneration.minTeams,
            max: this.settings.teamGeneration.maxTeams
        };
        const playerLimits = {
            min: this.settings.teamGeneration.minPlayersPerTeam,
            max: this.settings.teamGeneration.maxPlayersPerTeam
        };
        const configurations = [];

        for (let t = teamLimits.min; t <= teamLimits.max && t * playerLimits.min <= count; t++) {
            const minPlayers = Math.floor(count / t);
            const extraPlayers = count % t;
            const teamSizes = Array(t).fill(minPlayers);

            for (let i = 0; i < extraPlayers; i++) {
                teamSizes[i]++;
            }

            if (teamSizes.every((size) => size >= playerLimits.min && size <= playerLimits.max)) {
                configurations.push({
                    teams: t,
                    teamSizes: teamSizes
                });
            }
        }
        return configurations;
    }

    /**
     * Generate random team names
     * @param {number} count - Number of team names to generate
     * @returns {Array} Array of team names
     */
    generateTeamNames(count) {
        const usedNouns = new Set();
        const teamNames = [];

        const colorSlice = teamColours.slice(0, count);
        const shuffledColours = colorSlice.sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
            let noun;
            let attempts = 0;

            // Find a unique noun, fallback to index-based if all nouns used
            do {
                noun = nouns[Math.floor(Math.random() * nouns.length)];
                attempts++;
            } while (usedNouns.has(noun) && attempts < 50);

            usedNouns.add(noun);
            const color = shuffledColours[i % shuffledColours.length];
            teamNames.push(`${color} ${noun}`);
        }

        return teamNames;
    }

    /**
     * Record a step in the draw history
     * @param {string} player - Player name being assigned
     * @param {number} fromPot - Index of the pot the player is coming from
     * @param {string} toTeam - Team name the player is assigned to
     * @param {number} potPlayersRemaining - Number of players remaining in the pot
     */
    recordDrawStep(player, fromPot, toTeam, potPlayersRemaining) {
        if (!this.recordHistory) return;

        this.drawHistory.push({
            step: this.drawHistory.length + 1,
            player,
            fromPot,
            toTeam,
            potPlayersRemaining
        });
    }

    /**
     * Generate teams using random distribution
     * @param {Object} config - Team configuration { teams, teamSizes }
     * @returns {Object} Generated teams object
     */
    generateRandomTeams(config) {
        if (!this.players.length) {
            throw new TeamError('No players available for team generation', 400);
        }

        const teams = {};
        const teamSizes = config.teamSizes;
        const shuffledPlayers = [...this.players].sort(() => Math.random() - 0.5);
        const teamNames = this.generateTeamNames(teamSizes.length);

        // Record initial pot for history (in original registration order)
        if (this.recordHistory) {
            this.initialPots = [
                {
                    name: 'All Players',
                    players: this.players.map((name) => ({
                        name,
                        rankingPoints: null
                    }))
                }
            ];
        }

        // Initialize empty teams
        for (let i = 0; i < teamSizes.length; i++) {
            teams[teamNames[i]] = [];
        }

        // Assign players using round-robin approach
        let playerIndex = 0;
        const maxTeamSize = Math.max(...teamSizes);

        // Round-robin assignment: for each round, assign one player to each team that still needs players
        for (let round = 0; round < maxTeamSize && playerIndex < shuffledPlayers.length; round++) {
            for (
                let teamIndex = 0;
                teamIndex < teamNames.length && playerIndex < shuffledPlayers.length;
                teamIndex++
            ) {
                const teamName = teamNames[teamIndex];

                // Skip this team if it's already full
                if (teams[teamName].length >= teamSizes[teamIndex]) {
                    continue;
                }

                const player = shuffledPlayers[playerIndex];
                teams[teamName].push(player);

                this.recordDrawStep(
                    player,
                    0, // Single pot index
                    teamName,
                    shuffledPlayers.length - playerIndex - 1
                );

                playerIndex++;
            }
        }

        return teams;
    }

    /**
     * Generate teams using seeded distribution based on rankings
     * @param {Object} config - Team configuration { teams, teamSizes }
     * @returns {Object} Generated teams object
     */
    generateSeededTeams(config) {
        if (!this.players.length) {
            throw new TeamError('No players available for team generation', 400);
        }

        const teamSizes = config.teamSizes;
        const numTeams = teamSizes.length;
        const teams = {};
        const teamNames = this.generateTeamNames(numTeams);

        // Default ELO rating for unranked players
        const defaultElo = 1000;

        // Sort players by ELO rating first, then ranking points, then total points, then appearances
        const sortedPlayers = [...this.players].sort((a, b) => {
            const playerA = this.rankings?.players?.[a];
            const playerB = this.rankings?.players?.[b];

            // Use ELO rating as primary sort criterion
            const eloA = playerA?.elo?.rating ?? defaultElo;
            const eloB = playerB?.elo?.rating ?? defaultElo;

            if (eloA !== eloB) {
                return eloB - eloA;
            }

            // Fall back to ranking points for ties
            const rankingA = playerA?.rankingPoints ?? 0;
            const rankingB = playerB?.rankingPoints ?? 0;

            if (rankingA !== rankingB) {
                return rankingB - rankingA;
            }

            if ((playerA?.points || 0) !== (playerB?.points || 0)) {
                return (playerB?.points || 0) - (playerA?.points || 0);
            }

            return (playerB?.appearances || 0) - (playerA?.appearances || 0);
        });

        // Record initial pots for history (in ranking order)
        if (this.recordHistory) {
            this.initialPots = [];
            let playerIndex = 0;
            let potNumber = 1;

            // Create pots based on the seeded algorithm structure
            while (playerIndex < sortedPlayers.length) {
                const potSize = Math.min(numTeams * 2, sortedPlayers.length - playerIndex);
                const potPlayers = sortedPlayers.slice(playerIndex, playerIndex + potSize);

                this.initialPots.push({
                    name: `Pot ${potNumber}`,
                    players: potPlayers.map((name) => ({
                        name,
                        rankingPoints: this.rankings?.players?.[name]?.elo?.rating
                            ? Math.round(this.rankings.players[name].elo.rating)
                            : defaultElo
                    }))
                });

                playerIndex += potSize;
                potNumber++;
            }
        }

        // Initialise teams
        for (let i = 0; i < numTeams; i++) {
            teams[teamNames[i]] = [];
        }

        let playerIndex = 0;
        let currentPotIndex = 0;

        // Fill teams round by round until all are complete
        while (
            teamNames.some((name, i) => teams[name].length < teamSizes[i]) &&
            playerIndex < sortedPlayers.length
        ) {
            // Create a pot of players for this round (double size for variability)
            const potSize = Math.min(numTeams * 2, sortedPlayers.length - playerIndex);
            const currentPot = sortedPlayers.slice(playerIndex, playerIndex + potSize);

            // Randomise within the pot
            currentPot.sort(() => Math.random() - 0.5);

            let potPlayerIndex = 0;

            // Use round-robin distribution within this pot - keep cycling through teams until pot is empty
            while (potPlayerIndex < currentPot.length) {
                let assignedThisRound = false;

                // Go through each team once per round
                for (
                    let teamIndex = 0;
                    teamIndex < numTeams && potPlayerIndex < currentPot.length;
                    teamIndex++
                ) {
                    const teamName = teamNames[teamIndex];
                    const currentTeamSize = teams[teamName].length;
                    const targetTeamSize = teamSizes[teamIndex];

                    // Skip if the team is already full
                    if (currentTeamSize >= targetTeamSize) continue;

                    // Assign exactly 1 player per team per round (round-robin)
                    const player = currentPot[potPlayerIndex];
                    teams[teamName].push(player);

                    this.recordDrawStep(
                        player,
                        currentPotIndex,
                        teamName,
                        currentPot.length - potPlayerIndex - 1
                    );

                    potPlayerIndex++;
                    assignedThisRound = true;
                }

                // Safety check: if no players were assigned this round, break to avoid infinite loop
                if (!assignedThisRound) break;
            }

            // Move to the next batch of players
            playerIndex += potSize;
            currentPotIndex++;
        }

        return teams;
    }

    /**
     * Generate teams using the specified method
     * @param {string} method - 'random' or 'seeded'
     * @param {Object} config - Team configuration { teams, teamSizes }
     * @returns {Object} Generated teams object with metadata
     */
    generateTeams(method, config) {
        if (!this.settings) {
            throw new TeamError('Settings must be set before generating teams', 400);
        }

        if (!config || !config.teamSizes || !Array.isArray(config.teamSizes)) {
            throw new TeamError('Invalid team configuration provided', 400);
        }

        if (!['random', 'seeded'].includes(method)) {
            throw new TeamError(`Invalid team generation method: ${method}`, 400);
        }

        const totalPlayersNeeded = config.teamSizes.reduce((sum, size) => sum + size, 0);
        if (totalPlayersNeeded > this.players.length) {
            throw new TeamError(
                `Not enough players: need ${totalPlayersNeeded}, have ${this.players.length}`,
                400
            );
        }

        // Reset history before generation
        this.drawHistory = [];
        this.initialPots = [];

        const teams =
            method === 'seeded'
                ? this.generateSeededTeams(config)
                : this.generateRandomTeams(config);

        const result = {
            teams,
            config: {
                method,
                teams: config.teams,
                totalPlayers: this.players.length,
                playersUsed: config.teamSizes.reduce((sum, size) => sum + size, 0)
            }
        };

        // Include draw history if recording is enabled
        if (this.recordHistory) {
            result.drawHistory = {
                drawHistory: this.drawHistory,
                initialPots: this.initialPots,
                method
            };
        }

        return result;
    }
}

/**
 * Create a new TeamGenerator instance
 * @returns {TeamGenerator}
 */
export function createTeamGenerator() {
    return new TeamGenerator();
}
