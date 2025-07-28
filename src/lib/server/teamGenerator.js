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

        for (let i = 0; i < count; i++) {
            let noun;
            let attempts = 0;

            // Find a unique noun, fallback to index-based if all nouns used
            do {
                noun = nouns[Math.floor(Math.random() * nouns.length)];
                attempts++;
            } while (usedNouns.has(noun) && attempts < 50);

            usedNouns.add(noun);
            const color = teamColours[i % teamColours.length];
            teamNames.push(`${color} ${noun}`);
        }

        return teamNames;
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

        for (let i = 0; i < teamSizes.length; i++) {
            teams[teamNames[i]] = shuffledPlayers.splice(0, teamSizes[i]);
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

        // Sort players by ranking points first, then total points, then appearances
        const sortedPlayers = [...this.players].sort((a, b) => {
            const playerA = this.rankings?.players?.[a];
            const playerB = this.rankings?.players?.[b];

            if (playerA?.rankingPoints !== undefined && playerB?.rankingPoints !== undefined) {
                if (playerA.rankingPoints !== playerB.rankingPoints) {
                    return playerB.rankingPoints - playerA.rankingPoints;
                }
            }

            if ((playerA?.points || 0) !== (playerB?.points || 0)) {
                return (playerB?.points || 0) - (playerA?.points || 0);
            }

            return (playerB?.appearances || 0) - (playerA?.appearances || 0);
        });

        // Initialise teams
        for (let i = 0; i < numTeams; i++) {
            teams[teamNames[i]] = [];
        }

        let playerIndex = 0;

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

            // Distribute players from this pot to teams that still need players
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

                // Determine how many players to assign (1 or 2, but no more than available in pot)
                const remainingSpots = targetTeamSize - currentTeamSize;
                const availableInPot = currentPot.length - potPlayerIndex;
                const playersToAssign = Math.min(2, remainingSpots, availableInPot);

                // Assign players from pot to this team
                for (let p = 0; p < playersToAssign; p++) {
                    teams[teamName].push(currentPot[potPlayerIndex++]);
                }
            }

            // Move to the next batch of players
            playerIndex += potSize;
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

        const teams =
            method === 'seeded'
                ? this.generateSeededTeams(config)
                : this.generateRandomTeams(config);

        return {
            teams,
            config: {
                method,
                teams: config.teams,
                totalPlayers: this.players.length,
                playersUsed: config.teamSizes.reduce((sum, size) => sum + size, 0)
            }
        };
    }
}

/**
 * Create a new TeamGenerator instance
 * @returns {TeamGenerator}
 */
export function createTeamGenerator() {
    return new TeamGenerator();
}
