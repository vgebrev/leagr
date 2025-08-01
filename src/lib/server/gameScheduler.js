import { validateScheduleData, validateGameRequest } from '$lib/shared/validation.js';
import { rotateArray } from '$lib/shared/helpers.js';

/**
 * Game scheduling error class
 */
export class GameSchedulerError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'GameSchedulerError';
        this.statusCode = statusCode;
    }
}

/**
 * Server-side game scheduling service
 * Handles round-robin schedule generation, score management, and validation
 */
export class GameScheduler {
    constructor() {
        this.teams = [];
        this.settings = null;
    }

    /**
     * Set the available teams for scheduling
     * @param {Array<string>} teams - Array of team names
     * @returns {GameScheduler} - Fluent interface
     */
    setTeams(teams) {
        if (!Array.isArray(teams)) {
            throw new GameSchedulerError('Teams must be an array', 400);
        }
        this.teams = teams.filter((team) => team && typeof team === 'string' && team.trim());
        return this;
    }

    /**
     * Set the settings for game scheduling
     * @param {Object} settings - Game scheduling settings (optional)
     * @returns {GameScheduler} - Fluent interface
     */
    setSettings(settings) {
        this.settings = settings;
        return this;
    }

    /**
     * Generates a round-robin schedule for the given teams.
     * Each team plays every other team once, with an optional bye if the number of teams is odd.
     * The schedule is generated in rounds, where each round contains matches between teams.
     * The first team in each round is fixed, and the rest are rotated to create the schedule.
     * @param {Array<string>} teams - Array of team names
     * @param {number} anchorIndex - Starting index for team rotation
     * @returns {Array<Array<Object>>} Array of rounds containing matches
     */
    generateRoundRobinRounds(teams, anchorIndex = 0) {
        if (!Array.isArray(teams) || teams.length === 0) {
            throw new GameSchedulerError('Teams array is required and cannot be empty', 400);
        }

        if (teams.length < 2) {
            throw new GameSchedulerError('At least 2 teams are required for scheduling', 400);
        }

        if (typeof anchorIndex !== 'number' || anchorIndex < 0) {
            throw new GameSchedulerError('Anchor index must be a non-negative number', 400);
        }

        const totalTeams = [...teams];

        // Add bye team if odd number of teams
        if (totalTeams.length % 2 !== 0) {
            totalTeams.push(null); // bye
        }

        const n = totalTeams.length;
        const rounds = [];

        const rotatedTeams = rotateArray(totalTeams, anchorIndex % totalTeams.length);

        for (let round = 0; round < n - 1; round++) {
            let matches = [];

            for (let i = 0; i < n / 2; i++) {
                const home = rotatedTeams[i];
                const away = rotatedTeams[n - 1 - i];

                if (home !== null && away !== null) {
                    const match =
                        round % 2 === 0
                            ? { home, away, homeScore: null, awayScore: null }
                            : { home: away, away: home, homeScore: null, awayScore: null };
                    matches.push(match);
                } else {
                    const byeTeam = home ?? away;
                    matches.push({ bye: byeTeam });
                }
            }

            // Alternate match order for odd rounds
            if (round % 2 !== 0) {
                const [first, ...rest] = matches;
                matches = [...rest, first];
            }

            rounds.push(matches);

            // Rotate teams for next round (keep first team fixed)
            const fixed = rotatedTeams[0];
            const rotated = [fixed, ...rotatedTeams.slice(-1), ...rotatedTeams.slice(1, -1)];
            rotatedTeams.splice(0, n, ...rotated);
        }

        return rounds;
    }

    /**
     * Generates a full round-robin schedule for the given teams.
     * This includes both legs of the round-robin, where each team plays every other team twice.
     * The first leg is generated normally, and the second leg is the reverse of the first leg.
     * @param {Array<string>} teams - Array of team names
     * @param {number} anchorIndex - Starting index for team rotation
     * @returns {Array<Array<Object>>} Array of rounds containing matches for both legs
     */
    generateFullRoundRobinSchedule(teams, anchorIndex = 0) {
        const firstLeg = this.generateRoundRobinRounds(teams, anchorIndex);
        const secondLeg = firstLeg.map((round) =>
            round.map((match) => {
                if (match.bye) return match;
                return { home: match.away, away: match.home, homeScore: null, awayScore: null };
            })
        );
        return [...firstLeg, ...secondLeg];
    }

    /**
     * Generate a new schedule using the set teams
     * @param {number} anchorIndex - Starting index for team rotation (optional, will be random if not provided)
     * @returns {{rounds: Array<Array<Object>>, anchorIndex: number}} Schedule data with rounds and anchor index
     */
    generateSchedule(anchorIndex = null) {
        if (this.teams.length === 0) {
            throw new GameSchedulerError('No teams available for schedule generation', 400);
        }

        if (this.teams.length < 2) {
            throw new GameSchedulerError(
                'At least 2 teams are required for schedule generation',
                400
            );
        }

        // Use provided anchor index or generate random one
        const finalAnchorIndex =
            anchorIndex !== null ? anchorIndex : Math.floor(Math.random() * this.teams.length);

        const rounds = this.generateFullRoundRobinSchedule(this.teams, finalAnchorIndex);

        return {
            rounds,
            anchorIndex: finalAnchorIndex
        };
    }

    /**
     * Add more rounds to an existing schedule
     * @param {Array<Array<Object>>} existingRounds - Existing schedule rounds
     * @param {number} anchorIndex - Anchor index used for the existing schedule
     * @returns {{rounds: Array<Array<Object>>, anchorIndex: number}} Extended schedule data
     */
    addMoreRounds(existingRounds, anchorIndex) {
        if (!Array.isArray(existingRounds)) {
            throw new GameSchedulerError('Existing rounds must be an array', 400);
        }

        if (typeof anchorIndex !== 'number' || anchorIndex < 0) {
            throw new GameSchedulerError('Anchor index must be a non-negative number', 400);
        }

        const additionalRounds = this.generateFullRoundRobinSchedule(this.teams, anchorIndex);

        return {
            rounds: [...existingRounds, ...additionalRounds],
            anchorIndex
        };
    }

    /**
     * Validate and sanitize schedule data
     * @param {Object} scheduleData - Schedule data to validate
     * @returns {Object} Validated and sanitized schedule data
     */
    validateSchedule(scheduleData) {
        const validation = validateScheduleData(scheduleData);

        if (!validation.isValid) {
            throw new GameSchedulerError(
                `Invalid schedule data: ${validation.errors.join(', ')}`,
                400
            );
        }

        return validation.sanitizedData;
    }

    /**
     * Validate a games API request
     * @param {Object} requestBody - Request body to validate
     * @returns {Object} Validated and sanitized request data
     */
    validateGameRequest(requestBody) {
        const validation = validateGameRequest(requestBody);

        if (!validation.isValid) {
            throw new GameSchedulerError(
                `Invalid game request: ${validation.errors.join(', ')}`,
                400
            );
        }

        return validation.sanitizedData;
    }

    /**
     * Check if a schedule is complete (all games have scores)
     * @param {Array<Array<Object>>} rounds - Schedule rounds to check
     * @returns {{isComplete: boolean, playedGames: number, totalGames: number}} Completion status
     */
    getScheduleStatus(rounds) {
        if (!Array.isArray(rounds)) {
            throw new GameSchedulerError('Rounds must be an array', 400);
        }

        let totalGames = 0;
        let playedGames = 0;

        for (const round of rounds) {
            if (!Array.isArray(round)) continue;

            for (const match of round) {
                if (match.bye) continue; // Skip bye matches

                totalGames++;

                // Check if game has been played (both scores are not null)
                if (match.homeScore !== null && match.awayScore !== null) {
                    playedGames++;
                }
            }
        }

        return {
            isComplete: totalGames > 0 && playedGames === totalGames,
            playedGames,
            totalGames
        };
    }

    /**
     * Get match results from completed games in rounds
     * @param {Array<Array<Object>>} rounds - Schedule rounds
     * @returns {Array<Object>} Array of completed match results
     */
    getMatchResults(rounds) {
        if (!Array.isArray(rounds)) {
            throw new GameSchedulerError('Rounds must be an array', 400);
        }

        const results = [];

        for (const round of rounds) {
            if (!Array.isArray(round)) continue;

            for (const game of round) {
                if (game.bye) continue; // Skip bye matches

                const { home, away, homeScore, awayScore } = game;

                // Only include completed games
                if (
                    homeScore !== null &&
                    awayScore !== null &&
                    typeof homeScore === 'number' &&
                    typeof awayScore === 'number'
                ) {
                    results.push({ home, away, homeScore, awayScore });
                }
            }
        }

        return results;
    }

    /**
     * Process a complete schedule operation (generate, validate, and return)
     * @param {Object} options - Options for schedule generation
     * @param {Array<string>} options.teams - Array of team names
     * @param {number} [options.anchorIndex] - Starting index for team rotation
     * @param {Array<Array<Object>>} [options.existingRounds] - Existing rounds to extend
     * @param {boolean} [options.addMore] - Whether to add more rounds to existing schedule
     * @returns {Object} Complete schedule data
     */
    processScheduleRequest(options = {}) {
        const { teams, anchorIndex, existingRounds, addMore = false } = options;

        // Set teams if provided
        if (teams) {
            this.setTeams(teams);
        }

        if (this.teams.length === 0) {
            throw new GameSchedulerError('No teams available for schedule generation', 400);
        }

        let scheduleData;

        if (addMore && existingRounds) {
            // Add more rounds to existing schedule
            scheduleData = this.addMoreRounds(existingRounds, anchorIndex);
        } else {
            // Generate new schedule
            scheduleData = this.generateSchedule(anchorIndex);
        }

        // Validate the generated schedule
        const validatedSchedule = this.validateSchedule(scheduleData);

        // Add schedule status information
        const status = this.getScheduleStatus(validatedSchedule.rounds);

        return {
            ...validatedSchedule,
            status
        };
    }
}

/**
 * Create a new GameScheduler instance
 * @returns {GameScheduler}
 */
export function createGameScheduler() {
    return new GameScheduler();
}
