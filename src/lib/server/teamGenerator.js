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
class TeamGenerator {
    constructor() {
        this.settings = null;
        this.players = [];
        this.rankings = null;
        this.recordHistory = false;
        this.drawHistory = [];
        this.initialPots = [];
        this.teammateHistory = null;
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
     * Set the teammate history for variance-conscious team generation
     * @param {Object} teammateHistory - Teammate history data with matrix and players
     * @returns {TeamGenerator} - Fluent interface
     */
    setTeammateHistory(teammateHistory) {
        this.teammateHistory = teammateHistory;
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
                playerIndex++;
            }
        }

        // Set up initial pots for history reconstruction if recording is enabled
        if (this.recordHistory) {
            const defaultElo = 1000;
            this.initialPots = [
                {
                    name: 'All Players',
                    players: this.players.map((name) => {
                        const playerRanking = this.rankings?.players?.[name];
                        return {
                            name,
                            elo: playerRanking?.elo?.rating
                                ? Math.round(playerRanking.elo.rating)
                                : defaultElo,
                            avatar: playerRanking?.avatar || null
                        };
                    })
                }
            ];

            // Reconstruct draw history from final teams
            this.drawHistory = this.buildDrawHistoryFromFinalTeams(
                teams,
                this.initialPots,
                teamNames
            );
        }

        return teams;
    }

    /**
     * Calculate team ELO averages for balance assessment
     * @param {Object} teams - Teams object with player names
     * @returns {Array} Array of team ELO averages
     */
    calculateTeamEloAverages(teams) {
        const defaultElo = 1000;
        const teamAverages = [];

        Object.values(teams).forEach((teamPlayers) => {
            const teamEloSum = teamPlayers.reduce((sum, playerName) => {
                const playerRanking = this.rankings?.players?.[playerName];
                const playerElo = playerRanking?.elo?.rating ?? defaultElo;
                return sum + playerElo;
            }, 0);

            teamAverages.push(teamPlayers.length > 0 ? teamEloSum / teamPlayers.length : 0);
        });

        return teamAverages;
    }

    /**
     * Calculate team average rating for a given player rating key (e.g., attackingRating).
     * Unrated players are skipped; if a team has no rated players, fall back to a neutral 0.5.
     * @param {Object} teams - Teams object with player names
     * @param {'attackingRating'|'controlRating'} ratingKey
     * @param {number} [defaultValue=0.5] - Neutral fallback when no rated players are present
     * @returns {Array<number>} Array of team rating averages (0-1 scale)
     */
    calculateTeamRatingAverages(teams, ratingKey, defaultValue = 0.5) {
        const teamAverages = [];

        Object.values(teams).forEach((teamPlayers) => {
            if (!Array.isArray(teamPlayers) || teamPlayers.length === 0) {
                teamAverages.push(defaultValue);
                return;
            }

            const { sum, count } = teamPlayers.reduce(
                (acc, playerName) => {
                    const rating = this.rankings?.players?.[playerName]?.[ratingKey];
                    if (typeof rating === 'number') {
                        acc.sum += rating;
                        acc.count += 1;
                    }
                    return acc;
                },
                { sum: 0, count: 0 }
            );

            teamAverages.push(count > 0 ? sum / count : defaultValue);
        });

        return teamAverages;
    }

    /**
     * Calculate ELO delta (difference between strongest and weakest team)
     * @param {Array} teamEloAverages - Array of team ELO averages
     * @returns {number} ELO delta
     */
    calculateEloDelta(teamEloAverages) {
        if (teamEloAverages.length === 0) return 0;
        const maxElo = Math.max(...teamEloAverages);
        const minElo = Math.min(...teamEloAverages);
        return maxElo - minElo;
    }

    /**
     * Extract all teammate pairs from generated teams
     * @param {Object} teams - Teams object with player names
     * @returns {Array<Array<string>>} Array of player pairs
     */
    extractTeammatePairs(teams) {
        const pairs = [];

        Object.values(teams).forEach((team) => {
            if (!Array.isArray(team)) return;

            // Generate all unique pairs within each team
            for (let i = 0; i < team.length; i++) {
                for (let j = i + 1; j < team.length; j++) {
                    // Sort pair for consistent lookup
                    const pair = [team[i], team[j]].sort();
                    pairs.push(pair);
                }
            }
        });

        return pairs;
    }

    /**
     * Check if a team configuration violates hard constraints
     * @param {Object} teams - Teams object with team names as keys and player arrays as values
     * @param {number} pairingLimit - Maximum allowed previous pairings (default: 3)
     * @param {number} eloDeltaLimit - Maximum allowed ELO delta between teams (optional)
     * @returns {boolean} True if configuration violates constraints
     */
    violatesHardConstraints(teams, pairingLimit = 3, eloDeltaLimit = null) {
        // Check pairing constraints
        if (this.teammateHistory) {
            const pairs = this.extractTeammatePairs(teams);

            for (const [player1, player2] of pairs) {
                const index1 = this.teammateHistory.players.indexOf(player1);
                const index2 = this.teammateHistory.players.indexOf(player2);

                if (index1 >= 0 && index2 >= 0) {
                    const pairingCount = this.teammateHistory.matrix[index1][index2];
                    if (pairingCount >= pairingLimit) {
                        return true; // Pairing constraint violated
                    }
                }
            }
        }

        // Check ELO delta constraint
        if (eloDeltaLimit !== null) {
            const teamAverages = this.calculateTeamEloAverages(teams);
            const eloDelta = this.calculateEloDelta(teamAverages);
            if (eloDelta > eloDeltaLimit) {
                return true; // ELO balance constraint violated
            }
        }

        return false; // No constraints violated
    }

    /**
     * Calculate normalized pairing score (0-1) where lower is better (more novel).
     * Uses soft penalties for repeats and rewards fresh pairings.
     * @param {Object} teams - Generated teams object
     * @returns {number} Normalized pairing score between 0 (ideal) and 1 (stale)
     */
    calculatePairingScoreNormalized(teams) {
        if (!this.teammateHistory) {
            return 0; // Neutral/best score when no history is available
        }

        const pairs = this.extractTeammatePairs(teams);
        if (pairs.length === 0) return 0;

        let totalScore = 0;

        pairs.forEach(([player1, player2]) => {
            const index1 = this.teammateHistory.players.indexOf(player1);
            const index2 = this.teammateHistory.players.indexOf(player2);

            // Treat unknown players as never teamed
            const pairingCount =
                index1 >= 0 && index2 >= 0 ? this.teammateHistory.matrix[index1][index2] : 0;

            let pairScore;
            if (pairingCount === 0) {
                pairScore = -1.0;
            } else if (pairingCount === 1) {
                pairScore = -0.5;
            } else if (pairingCount === 2) {
                pairScore = 0;
            } else if (pairingCount === 3) {
                pairScore = 0.5;
            } else {
                pairScore = 1.0;
            }

            totalScore += pairScore;
        });

        const averageScore = totalScore / pairs.length; // [-1, 1]
        const normalizedScore = (averageScore + 1) / 2; // [0, 1], lower is better
        return Math.min(1, Math.max(0, normalizedScore));
    }

    /**
     * Calculate ELO spread balance to ensure each team has similar distribution of skill levels.
     * Prevents one team from getting all "top of pot" players while another gets all "bottom of pot".
     * @param {Object} teams - Generated teams object
     * @returns {number} Spread imbalance score (lower is better)
     */
    calculateEloSpreadBalance(teams) {
        const defaultElo = 1000;
        const teamEloDistributions = [];

        // Calculate ELO distribution for each team
        Object.values(teams).forEach((teamPlayers) => {
            const elos = teamPlayers.map((playerName) => {
                const playerRanking = this.rankings?.players?.[playerName];
                return playerRanking?.elo?.rating ?? defaultElo;
            });

            if (elos.length > 0) {
                elos.sort((a, b) => b - a); // Sort descending
                teamEloDistributions.push({
                    max: elos[0],
                    min: elos[elos.length - 1],
                    median: elos[Math.floor(elos.length / 2)]
                });
            }
        });

        if (teamEloDistributions.length < 2) return 0;

        // Calculate variance in max players across teams
        const maxElos = teamEloDistributions.map((d) => d.max);
        const maxRange = Math.max(...maxElos) - Math.min(...maxElos);

        // Calculate variance in min players across teams
        const minElos = teamEloDistributions.map((d) => d.min);
        const minRange = Math.max(...minElos) - Math.min(...minElos);

        // Calculate variance in median players across teams
        const medianElos = teamEloDistributions.map((d) => d.median);
        const medianRange = Math.max(...medianElos) - Math.min(...medianElos);

        // Combined spread imbalance (weight median most, then max, then min)
        return medianRange * 1.0 + maxRange * 0.6 + minRange * 0.4;
    }

    /**
     * Calculate ELO range for the current pool, respecting minimum games for reliable ratings.
     * @param {Array<string>} sortedPlayers - Players in consideration
     * @param {number} minGamesForElo - Minimum games before ELO is trusted
     * @param {number} defaultElo - Default ELO used when unreliable
     * @returns {number} Range between max and min ELO in the pool
     */
    calculatePoolEloRange(sortedPlayers, minGamesForElo = 5, defaultElo = 1000) {
        if (!Array.isArray(sortedPlayers) || sortedPlayers.length === 0) return 0;
        const elos = sortedPlayers.map((name) => {
            const playerData = this.rankings?.players?.[name];
            const eloGames = playerData?.elo?.gamesPlayed ?? 0;
            return eloGames >= minGamesForElo
                ? (playerData?.elo?.rating ?? defaultElo)
                : defaultElo;
        });
        return Math.max(...elos) - Math.min(...elos);
    }

    /**
     * Calculate normalized scoring metrics for a given team configuration.
     * @param {Object} teams - Generated teams object
     * @param {number} eloRange - Range of ELO values in the current pool
     * @param {number} hardEloDeltaLimit - Hard cap for acceptable ELO delta
     * @returns {{
     *  totalNorm: number,
     *  eloNorm: number,
     *  spreadNorm: number,
     *  pairNorm: number,
     *  attackNorm: number,
     *  controlNorm: number,
     *  eloDelta: number,
     *  spreadBalance: number,
     *  attackDelta: number,
     *  controlDelta: number
     * }} Normalized metrics where lower is better
     */
    calculateNormalizedScore(teams, eloRange, hardEloDeltaLimit) {
        const W_ELO = 1.0;
        const W_SPREAD = 0.7;
        const W_PAIR = 1.3;
        const W_ATTACK = 0.8;
        const W_CONTROL = 0.8;
        const RATING_DELTA_CAP = 0.2; // Treat a 20-point gap as fully unacceptable
        const clamp01 = (value) => Math.min(1, Math.max(0, value));

        // Calculate team ELO balance
        const teamAverages = this.calculateTeamEloAverages(teams);
        const eloDelta = this.calculateEloDelta(teamAverages);
        const eloNorm = clamp01(hardEloDeltaLimit ? eloDelta / hardEloDeltaLimit : 0);

        // Attacking / control balance (skip unrated players, neutral fallback per team)
        const attackAverages = this.calculateTeamRatingAverages(teams, 'attackingRating', 0.5);
        const controlAverages = this.calculateTeamRatingAverages(teams, 'controlRating', 0.5);
        const attackDelta =
            attackAverages.length > 0
                ? Math.max(...attackAverages) - Math.min(...attackAverages)
                : 0;
        const controlDelta =
            controlAverages.length > 0
                ? Math.max(...controlAverages) - Math.min(...controlAverages)
                : 0;
        const attackNorm = clamp01(attackDelta / RATING_DELTA_CAP);
        const controlNorm = clamp01(controlDelta / RATING_DELTA_CAP);

        // Pairing novelty score
        const pairNorm = this.calculatePairingScoreNormalized(teams);

        // Spread balance normalization
        const spreadBalance = this.calculateEloSpreadBalance(teams);
        const spreadIdeal = eloRange * 0.5;
        const spreadWorst = Math.max(spreadIdeal + 1, eloRange * 1.5);
        const spreadNorm =
            spreadWorst === spreadIdeal
                ? 0
                : clamp01((spreadBalance - spreadIdeal) / (spreadWorst - spreadIdeal));

        const totalNorm =
            (eloNorm * W_ELO +
                spreadNorm * W_SPREAD +
                pairNorm * W_PAIR +
                attackNorm * W_ATTACK +
                controlNorm * W_CONTROL) /
            (W_ELO + W_SPREAD + W_PAIR + W_ATTACK + W_CONTROL);

        return {
            totalNorm,
            eloNorm,
            spreadNorm,
            pairNorm,
            attackNorm,
            controlNorm,
            eloDelta,
            spreadBalance,
            attackDelta,
            controlDelta
        };
    }

    /**
     * Reconstruct draw history from final teams using snake draft pattern.
     * Since team generation is randomized and iterative, we reconstruct a plausible
     * draw history that matches the final team assignments and follows the snake draft pattern.
     *
     * @param {Object} teams - Final teams object
     * @param {Array} initialPots - Pots captured after best team selection
     * @param {Array<string>} teamNames - Team names in assignment order
     * @returns {Array<Object>} Reconstructed draw steps
     */
    buildDrawHistoryFromFinalTeams(teams, initialPots, teamNames) {
        if (!initialPots || initialPots.length === 0 || !teamNames?.length) return [];

        // Build mapping of player -> pot index
        const playerPotMap = new Map();
        for (let potIndex = 0; potIndex < initialPots.length; potIndex++) {
            const pot = initialPots[potIndex];
            for (const player of pot.players) {
                playerPotMap.set(player.name, potIndex);
            }
        }

        const steps = [];

        // Group players from each team by their pot
        const teamsByPot = teamNames.map((teamName) => {
            const playersByPot = [];
            for (let potIndex = 0; potIndex < initialPots.length; potIndex++) {
                playersByPot.push([]);
            }

            for (const player of teams[teamName]) {
                const potIndex = playerPotMap.get(player) ?? 0;
                playersByPot[potIndex].push(player);
            }

            return {
                name: teamName,
                playersByPot
            };
        });

        // Process each pot sequentially
        for (let potIndex = 0; potIndex < initialPots.length; potIndex++) {
            // Determine how many rounds needed for this pot (max players any team has from this pot)
            const maxPlayersInPot = Math.max(
                ...teamsByPot.map((t) => t.playersByPot[potIndex].length)
            );

            // Traverse this pot in snake draft order: 1,2,3,4,4,3,2,1,1,2,3,4...
            for (let round = 0; round < maxPlayersInPot; round++) {
                // Snake pattern: alternate between forward and reverse
                const teamOrder = round % 2 === 0 ? teamsByPot : [...teamsByPot].reverse();

                for (const team of teamOrder) {
                    if (team.playersByPot[potIndex].length > 0) {
                        const player = team.playersByPot[potIndex].shift();

                        // Count remaining players in this pot across all teams
                        let potPlayersRemaining = 0;
                        for (const otherTeam of teamsByPot) {
                            potPlayersRemaining += otherTeam.playersByPot[potIndex].length;
                        }

                        steps.push({
                            step: steps.length + 1,
                            player,
                            fromPot: potIndex,
                            toTeam: team.name,
                            potPlayersRemaining
                        });
                    }
                }
            }
        }

        return steps;
    }

    /**
     * Optimize teams using within-pot swaps to improve balance using normalized scoring.
     * @param {Object} teams - Current team assignments
     * @param {Array} sortedPlayers - Players sorted by ELO (same order used in generation)
     * @param {Object} options - { maxSwaps, eloRange, hardEloDeltaLimit }
     * @returns {Object} Optimized teams object
     */
    optimizeTeamsWithSwaps(teams, sortedPlayers, options = {}) {
        const { maxSwaps = 200, eloRange = null, hardEloDeltaLimit = null } = options;
        if (!this.teammateHistory || !this.initialPots || this.initialPots.length === 0) {
            return teams; // Need history and pot structure for optimization
        }
        const teamNames = Object.keys(teams);
        let optimizedTeams = structuredClone(teams);
        let swapsAttempted = 0;
        let improvementsMade = true;

        const defaultElo = 1000;
        const minGamesForElo = 5;
        const effectiveEloRange =
            eloRange ?? this.calculatePoolEloRange(sortedPlayers, minGamesForElo, defaultElo) ?? 0;
        const effectiveHardEloDeltaLimit =
            hardEloDeltaLimit ?? Math.max(60, Math.floor(effectiveEloRange * 0.15));

        while (improvementsMade && swapsAttempted < maxSwaps) {
            improvementsMade = false;
            const currentMetrics = this.calculateNormalizedScore(
                optimizedTeams,
                effectiveEloRange,
                effectiveHardEloDeltaLimit
            );

            // Try swaps within each pot using existing pot structure
            for (
                let potIndex = 0;
                potIndex < this.initialPots.length && swapsAttempted < maxSwaps;
                potIndex++
            ) {
                const pot = this.initialPots[potIndex];

                // Group pot players by their current team assignment
                const playersByTeam = {};
                pot.players.forEach(({ name: playerName }) => {
                    const currentTeam = teamNames.find((team) =>
                        optimizedTeams[team].includes(playerName)
                    );
                    if (currentTeam) {
                        if (!playersByTeam[currentTeam]) playersByTeam[currentTeam] = [];
                        playersByTeam[currentTeam].push(playerName);
                    }
                });

                const teamsInPot = Object.keys(playersByTeam);

                // Try all team pairs within this pot
                for (let i = 0; i < teamsInPot.length && swapsAttempted < maxSwaps; i++) {
                    for (let j = i + 1; j < teamsInPot.length && swapsAttempted < maxSwaps; j++) {
                        const teamA = teamsInPot[i];
                        const teamB = teamsInPot[j];
                        const playersA = playersByTeam[teamA];
                        const playersB = playersByTeam[teamB];

                        for (const playerA of playersA) {
                            for (const playerB of playersB) {
                                swapsAttempted++;

                                const testTeams = structuredClone(optimizedTeams);
                                const teamAIndex = testTeams[teamA].indexOf(playerA);
                                const teamBIndex = testTeams[teamB].indexOf(playerB);

                                testTeams[teamA][teamAIndex] = playerB;
                                testTeams[teamB][teamBIndex] = playerA;

                                const testMetrics = this.calculateNormalizedScore(
                                    testTeams,
                                    effectiveEloRange,
                                    effectiveHardEloDeltaLimit
                                );

                                if (
                                    testMetrics.eloDelta <= effectiveHardEloDeltaLimit &&
                                    (testMetrics.totalNorm < currentMetrics.totalNorm ||
                                        (testMetrics.totalNorm === currentMetrics.totalNorm &&
                                            testMetrics.eloDelta < currentMetrics.eloDelta))
                                ) {
                                    optimizedTeams = testTeams;
                                    improvementsMade = true;
                                    break;
                                }
                            }
                            if (improvementsMade) break;
                        }
                        if (improvementsMade) break;
                    }
                    if (improvementsMade) break;
                }
                if (improvementsMade) break;
            }
        }
        return optimizedTeams;
    }

    /**
     * Generate a single iteration of seeded teams (without optimization)
     * @param {Object} config - Team configuration { teams, teamSizes }
     * @param {Array} teamNames - Pre-generated team names
     * @param {Array} sortedPlayers - Players sorted by ELO/ranking
     * @returns {Object} Generated teams object
     */
    generateSeededTeamsIteration(config, teamNames, sortedPlayers) {
        const teamSizes = config.teamSizes;
        const numTeams = teamSizes.length;
        const teams = {};

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
            // Create a pot of players for this round (2x teams for tighter variance)
            const potSize = Math.min(Math.ceil(numTeams * 2), sortedPlayers.length - playerIndex);
            const currentPot = sortedPlayers.slice(playerIndex, playerIndex + potSize);

            // Randomise within the pot
            currentPot.sort(() => Math.random() - 0.5);

            // Use consistent team order across all pots for accurate history reconstruction
            // Randomization is preserved through: shuffled players in pots, multiple iterations, and optimization
            const teamIndices = Array.from({ length: numTeams }, (_, i) => i);

            let potPlayerIndex = 0;
            let roundInPot = 0;

            // Use snake draft pattern within this pot
            while (potPlayerIndex < currentPot.length) {
                let assignedThisRound = false;

                // Determine team order for this round (snake pattern using consistent team indices)
                const currentTeamOrder =
                    roundInPot % 2 === 0
                        ? teamIndices // Even rounds: forward order (0,1,2,3...)
                        : [...teamIndices].reverse(); // Odd rounds: reverse order (...3,2,1,0)

                // Go through teams in the determined order
                for (
                    let orderIndex = 0;
                    orderIndex < currentTeamOrder.length && potPlayerIndex < currentPot.length;
                    orderIndex++
                ) {
                    const teamIndex = currentTeamOrder[orderIndex];
                    const teamName = teamNames[teamIndex];
                    const currentTeamSize = teams[teamName].length;
                    const targetTeamSize = teamSizes[teamIndex];

                    // Skip if the team is already full
                    if (currentTeamSize >= targetTeamSize) continue;

                    // Assign exactly 1 player per team per round (snake draft)
                    const player = currentPot[potPlayerIndex];
                    teams[teamName].push(player);
                    potPlayerIndex++;
                    assignedThisRound = true;
                }

                // Safety check: if no players were assigned this round, break to avoid infinite loop
                if (!assignedThisRound) break;

                roundInPot++;
            }

            // Move to the next batch of players
            playerIndex += potSize;
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
        const teamNames = this.generateTeamNames(numTeams);

        // Default ELO rating for unranked players
        const defaultElo = 1000;
        const minGamesForElo = 5; // Minimum games before ELO is considered reliable

        // Sort players by ELO rating first, then ranking points, then total points, then appearances
        const sortedPlayers = [...this.players].sort((a, b) => {
            const playerA = this.rankings?.players?.[a];
            const playerB = this.rankings?.players?.[b];

            // Use ELO rating as primary sort criterion
            // Players with fewer than minGamesForElo are treated as baseline for balance
            const eloGamesA = playerA?.elo?.gamesPlayed ?? 0;
            const eloGamesB = playerB?.elo?.gamesPlayed ?? 0;
            const eloA =
                eloGamesA >= minGamesForElo ? (playerA?.elo?.rating ?? defaultElo) : defaultElo;
            const eloB =
                eloGamesB >= minGamesForElo ? (playerB?.elo?.rating ?? defaultElo) : defaultElo;

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

        // Calculate adaptive ELO delta target based on player pool variance
        const eloRange = this.calculatePoolEloRange(sortedPlayers, minGamesForElo, defaultElo);
        // Hard limit: max(60, 15% of pool range) - allows up to ~100 for extreme variance
        const hardEloDeltaLimit = Math.max(60, Math.floor(eloRange * 0.15));

        const maxIterations = 5000;
        const hardConstraintLimit = 3; // Completely reject teams with pairs having 4+ previous pairings

        let bestTeams = null;
        let bestScore = Infinity; // Now tracking combined score instead of just ELO delta

        let iteration;
        // Iterate to find the best balance of ELO balance and pairing variety
        for (iteration = 0; iteration < maxIterations; iteration++) {
            // Generate teams for this iteration
            const teams = this.generateSeededTeamsIteration(config, teamNames, sortedPlayers);

            // Check hard constraints first - reject if violated
            if (this.violatesHardConstraints(teams, hardConstraintLimit, hardEloDeltaLimit)) {
                continue; // Skip this iteration - hard constraints violated
            }

            const metrics = this.calculateNormalizedScore(teams, eloRange, hardEloDeltaLimit);
            const { totalNorm } = metrics;

            // Track the best result (lowest combined score)
            if (totalNorm < bestScore) {
                bestScore = totalNorm;
                bestTeams = structuredClone(teams);
            }

            // Stop early if we achieve excellent balance across all metrics
            if (iteration > 2000 && totalNorm <= 0.25) {
                break;
            }
        }

        // Set up initial pots for history/optimization (static for all iterations)
        this.initialPots = [];
        let playerIndex = 0;
        let potNumber = 1;

        // Create pots based on the seeded algorithm structure
        while (playerIndex < sortedPlayers.length) {
            const potSize = Math.min(Math.ceil(numTeams * 2), sortedPlayers.length - playerIndex);
            const potPlayers = sortedPlayers.slice(playerIndex, playerIndex + potSize);

            this.initialPots.push({
                name: `Pot ${potNumber}`,
                players: potPlayers.map((name) => ({
                    name,
                    elo: this.rankings?.players?.[name]?.elo?.rating
                        ? Math.round(this.rankings.players[name].elo.rating)
                        : defaultElo,
                    avatar: this.rankings?.players?.[name]?.avatar || null,
                    attackingRating: this.rankings?.players?.[name]?.attackingRating ?? null,
                    controlRating: this.rankings?.players?.[name]?.controlRating ?? null
                }))
            });

            playerIndex += potSize;
            potNumber++;
        }

        // If no valid teams found, fall back to generation without hard constraints
        if (!bestTeams) {
            // Try one more time without hard constraints
            for (let fallbackIteration = 0; fallbackIteration < 5; fallbackIteration++) {
                const teams = this.generateSeededTeamsIteration(config, teamNames, sortedPlayers);

                const metrics = this.calculateNormalizedScore(teams, eloRange, hardEloDeltaLimit);
                const { totalNorm } = metrics;

                if (totalNorm < bestScore) {
                    bestScore = totalNorm;
                    bestTeams = structuredClone(teams);
                    break; // Take first reasonable solution
                }
            }
        }

        if (!bestTeams) {
            throw new Error('Failed to generate valid team configuration even with fallback');
        }

        // Apply post-generation swap optimization if we have teammate history
        if (this.teammateHistory && Object.keys(bestTeams).length >= 2) {
            bestTeams = this.optimizeTeamsWithSwaps(bestTeams, sortedPlayers, {
                eloRange,
                hardEloDeltaLimit
            });
        }

        // Reconstruct draw history from final teams using the pot structure and snake draft
        if (this.recordHistory) {
            // Use original teamNames order (creation order) to match front-end display
            this.drawHistory = this.buildDrawHistoryFromFinalTeams(
                bestTeams,
                this.initialPots,
                teamNames
            );
        }

        return bestTeams;
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

export default TeamGenerator;

/**
 * Create a new TeamGenerator instance
 * @returns {TeamGenerator}
 */
export function createTeamGenerator() {
    return new TeamGenerator();
}
