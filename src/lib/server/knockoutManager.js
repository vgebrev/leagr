import { data } from './data.js';
import { createStandingsManager } from './standings.js';

/**
 * Knockout tournament management error class
 */
export class KnockoutError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'KnockoutError';
        this.statusCode = statusCode;
    }
}

/**
 * Server-side knockout tournament management service
 * Handles knockout tournament creation, bracket management, and score updates
 */
export class KnockoutManager {
    constructor() {
        this.standingsManager = createStandingsManager();
    }

    /**
     * Generate knockout tournament bracket from current standings
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Object>} Generated bracket structure
     */
    async generateBracket(date, leagueId = null) {
        if (!date || typeof date !== 'string') {
            throw new KnockoutError('Valid date is required', 400);
        }

        try {
            const bracket = await this.standingsManager.getKnockoutBracketForDate(date, leagueId);

            if (bracket.teams.length < 2) {
                throw new KnockoutError(
                    'Not enough teams for knockout tournament. Need at least 2 teams with completed matches.',
                    400
                );
            }

            return bracket;
        } catch (error) {
            if (error instanceof KnockoutError) {
                throw error;
            }

            throw new KnockoutError(`Failed to generate knockout bracket: ${error.message}`, 500);
        }
    }

    /**
     * Save knockout tournament to storage
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Object} bracket - Bracket structure to save
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Object>} Saved bracket data
     */
    async saveBracket(date, bracket, leagueId = null) {
        if (!date || typeof date !== 'string') {
            throw new KnockoutError('Valid date is required', 400);
        }

        if (!bracket || typeof bracket !== 'object') {
            throw new KnockoutError('Valid bracket is required', 400);
        }

        try {
            // Get existing games data and add knockout bracket
            const games = (await data.get('games', date, leagueId)) || {};
            const updatedGames = {
                ...games,
                'knockout-games': bracket
            };

            const result = await data.set('games', date, updatedGames, {}, false, leagueId);

            if (!result) {
                throw new KnockoutError('Failed to save knockout bracket', 500);
            }

            return bracket;
        } catch (error) {
            if (error instanceof KnockoutError) {
                throw error;
            }

            throw new KnockoutError(`Failed to save knockout bracket: ${error.message}`, 500);
        }
    }

    /**
     * Get existing knockout tournament for a date
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Object|null>} Knockout tournament data or null
     */
    async getBracket(date, leagueId = null) {
        if (!date || typeof date !== 'string') {
            throw new KnockoutError('Valid date is required', 400);
        }

        try {
            const games = (await data.get('games', date, leagueId)) || {};
            return games['knockout-games'] || null;
        } catch (error) {
            throw new KnockoutError(`Failed to fetch knockout bracket: ${error.message}`, 500);
        }
    }

    /**
     * Update knockout match scores and advance winners
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {Array} updatedBracket - Updated bracket with scores
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Object>} Updated bracket data
     */
    async updateScores(date, updatedBracket, leagueId = null) {
        if (!date || typeof date !== 'string') {
            throw new KnockoutError('Valid date is required', 400);
        }

        if (!Array.isArray(updatedBracket)) {
            throw new KnockoutError('Valid bracket array is required', 400);
        }

        try {
            const existingBracket = await this.getBracket(date, leagueId);

            if (!existingBracket) {
                throw new KnockoutError('No knockout tournament exists for this date', 400);
            }

            // Process bracket to advance winners
            const processedBracket = this.advanceWinners(updatedBracket);

            // Validate and update bracket
            const updatedKnockout = {
                ...existingBracket,
                bracket: processedBracket
            };

            return await this.saveBracket(date, updatedKnockout, leagueId);
        } catch (error) {
            if (error instanceof KnockoutError) {
                throw error;
            }

            throw new KnockoutError(`Failed to update knockout scores: ${error.message}`, 500);
        }
    }

    /**
     * Advance winners to next round based on completed matches
     * @param {Array} bracket - Current bracket state
     * @returns {Array} Updated bracket with winners advanced
     */
    advanceWinners(bracket) {
        const processedBracket = [...bracket];

        // Group matches by round
        const roundOrder = ['quarter', 'semi', 'final'];
        const matchesByRound = {};

        processedBracket.forEach((match) => {
            if (!matchesByRound[match.round]) {
                matchesByRound[match.round] = [];
            }
            matchesByRound[match.round].push(match);
        });

        // Process each round in order
        roundOrder.forEach((currentRound) => {
            if (!matchesByRound[currentRound]) return;

            const currentMatches = matchesByRound[currentRound];

            // Determine next round
            const nextRoundIndex = roundOrder.indexOf(currentRound) + 1;
            if (nextRoundIndex >= roundOrder.length) return; // No next round

            const nextRound = roundOrder[nextRoundIndex];
            const nextMatches = matchesByRound[nextRound] || [];

            // Check completed matches and advance winners
            currentMatches.forEach((match, index) => {
                if (match.homeScore !== null && match.awayScore !== null) {
                    const winner = this.getMatchWinner(match);

                    if (winner && winner !== 'Draw') {
                        // Find the corresponding next round match
                        const nextMatchIndex = Math.floor(index / 2);
                        const nextMatch = nextMatches[nextMatchIndex];

                        if (nextMatch) {
                            // Determine if winner goes to home or away position
                            const isHome = index % 2 === 0;

                            if (isHome) {
                                nextMatch.home = winner;
                            } else {
                                nextMatch.away = winner;
                            }
                        }
                    }
                }
            });
        });

        return processedBracket;
    }

    /**
     * Get the winner of a match
     * @param {Object} match - Match object with scores
     * @returns {string|null} Winner team name or 'Draw' or null
     */
    getMatchWinner(match) {
        if (match.homeScore === null || match.awayScore === null) return null;
        if (match.homeScore > match.awayScore) return match.home;
        if (match.awayScore > match.homeScore) return match.away;
        return 'Draw';
    }

    /**
     * Create and save a new knockout tournament
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Object>} Created tournament data
     */
    async createTournament(date, leagueId = null) {
        try {
            const bracket = await this.generateBracket(date, leagueId);
            return await this.saveBracket(date, bracket, leagueId);
        } catch (error) {
            if (error instanceof KnockoutError) {
                throw error;
            }

            throw new KnockoutError(`Failed to create knockout tournament: ${error.message}`, 500);
        }
    }

    /**
     * Check if knockout tournament exists for a date
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<boolean>} True if tournament exists
     */
    async tournamentExists(date, leagueId = null) {
        try {
            const bracket = await this.getBracket(date, leagueId);
            return bracket !== null;
        } catch {
            return false;
        }
    }
}

/**
 * Factory function to create a new KnockoutManager instance
 * @returns {KnockoutManager} New knockout manager instance
 */
export function createKnockoutManager() {
    return new KnockoutManager();
}
