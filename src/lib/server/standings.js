import { data } from './data.js';

/**
 * Standings calculation error class
 */
export class StandingsError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'StandingsError';
        this.statusCode = statusCode;
    }
}

/**
 * Server-side standings calculation service
 * Handles league table generation and knockout tournament seeding
 */
export class StandingsManager {
    constructor() {
        this.settings = null;
    }

    /**
     * Set settings for standings calculation
     * @param {Object} settings - Standings settings (optional)
     * @returns {StandingsManager} - Fluent interface
     */
    setSettings(settings) {
        this.settings = settings;
        return this;
    }

    /**
     * Calculate league standings from match results
     * @param {Array} matchups - Array of match objects with home, away, homeScore, awayScore
     * @returns {Array} Sorted array of team standings
     */
    calculateStandings(matchups) {
        if (!Array.isArray(matchups)) {
            throw new StandingsError('Matchups must be an array', 400);
        }

        const table = {};

        for (const matchup of matchups) {
            if (!matchup || typeof matchup !== 'object') {
                continue; // Skip invalid matchups
            }

            const { home, away, homeScore, awayScore } = matchup;

            // Skip unrecorded and bye matches
            if (homeScore === null || awayScore === null || matchup.bye) continue;

            // Validate team names
            if (!home || !away || typeof home !== 'string' || typeof away !== 'string') {
                continue; // Skip invalid team names
            }

            // Validate scores
            if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
                continue; // Skip invalid scores
            }

            for (const team of [home, away]) {
                if (!table[team]) {
                    table[team] = {
                        team,
                        played: 0,
                        wins: 0,
                        draws: 0,
                        losses: 0,
                        goalsFor: 0,
                        goalsAgainst: 0,
                        points: 0
                    };
                }
            }

            const homeTeam = table[home];
            const awayTeam = table[away];

            homeTeam.played++;
            awayTeam.played++;

            homeTeam.goalsFor += homeScore;
            homeTeam.goalsAgainst += awayScore;

            awayTeam.goalsFor += awayScore;
            awayTeam.goalsAgainst += homeScore;

            if (homeScore > awayScore) {
                homeTeam.wins++;
                awayTeam.losses++;
                homeTeam.points += 3;
            } else if (homeScore < awayScore) {
                awayTeam.wins++;
                homeTeam.losses++;
                awayTeam.points += 3;
            } else {
                homeTeam.draws++;
                awayTeam.draws++;
                homeTeam.points += 1;
                awayTeam.points += 1;
            }
        }

        return Object.values(table).sort((a, b) => {
            // Sort by points descending
            if (b.points !== a.points) return b.points - a.points;

            // Then by goal difference descending
            const gdA = a.goalsFor - a.goalsAgainst;
            const gdB = b.goalsFor - b.goalsAgainst;
            if (gdB !== gdA) return gdB - gdA;

            // Finally by goals for descending
            return b.goalsFor - a.goalsFor;
        });
    }

    /**
     * Get calculated standings for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Array>} Promise resolving to standings array
     */
    async getStandingsForDate(date, leagueId = null) {
        if (!date || typeof date !== 'string') {
            throw new StandingsError('Valid date is required', 400);
        }

        try {
            const games = await data.get('games', date, leagueId);
            const schedule = games?.rounds || [];

            // Flatten nested rounds structure if it exists
            const flatMatches =
                Array.isArray(schedule) && schedule.every(Array.isArray) ? schedule.flat() : [];

            return this.calculateStandings(flatMatches);
        } catch (error) {
            if (error instanceof StandingsError) {
                throw error; // Re-throw our custom errors
            }

            console.error('Error calculating standings for date:', date, error);
            throw new StandingsError(`Failed to calculate standings: ${error.message}`, 500);
        }
    }

    /**
     * Get team seeding order for knockout tournaments
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Array>} Promise resolving to teams in seeding order
     */
    async getKnockoutSeeding(date, leagueId = null) {
        try {
            const standings = await this.getStandingsForDate(date, leagueId);
            return standings.map((team) => team.team);
        } catch (error) {
            if (error instanceof StandingsError) {
                throw error;
            }

            throw new StandingsError(`Failed to get knockout seeding: ${error.message}`, 500);
        }
    }
}

/**
 * Factory function to create a new StandingsManager instance
 * @returns {StandingsManager} New standings manager instance
 */
export function createStandingsManager() {
    return new StandingsManager();
}
