import { data } from './data.js';

/**
 * Table of standings calculation error class
 */
export class StandingsError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'StandingsError';
        this.statusCode = statusCode;
    }
}

/**
 * Server-side Standings calculation service
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
     * @returns {Promise<Array>} Promise resolving to a Standings array
     */
    async getStandingsForDate(date, leagueId = null) {
        if (!date || typeof date !== 'string') {
            throw new StandingsError('Valid date is required', 400);
        }

        try {
            const games = await data.get('games', date, leagueId);
            const schedule = games?.rounds || [];

            // Flatten the nested rounds structure if it exists
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

    /**
     * Generate knockout tournament bracket from seeded teams
     * @param {Array<string>} teams - Teams in seeding order (1st, 2nd, 3rd, etc.)
     * @returns {Object} Bracket structure with teams and matches
     */
    generateKnockoutBracket(teams) {
        if (!Array.isArray(teams)) {
            throw new StandingsError('Teams must be an array', 400);
        }

        if (teams.length < 2) {
            return { teams: [], bracket: [] };
        }

        // Determine whether to round up (with byes) or round down (eliminate teams)
        const tournamentTeams = this.#adjustTeamsForBracket(teams);

        const bracket = [];

        // Generate matches by round
        let currentRound = tournamentTeams.slice();
        let roundName = this._getRoundName(currentRound.length);

        while (currentRound.length > 1) {
            const matches = [];
            const pairings = [];

            // Create standard tournament pairings (1 vs n, 2 vs n-1, etc.)
            for (let i = 0; i < currentRound.length / 2; i++) {
                const higherSeed = currentRound[i];
                const lowerSeed = currentRound[currentRound.length - 1 - i];
                pairings.push([higherSeed, lowerSeed]);
            }

            // Create matches in reverse order (top seeds play later)
            for (let i = pairings.length - 1; i >= 0; i--) {
                const [home, away] = pairings[i];
                const match = {
                    round: roundName,
                    match: pairings.length - i,
                    home,
                    away,
                    homeScore: null,
                    awayScore: null
                };

                // Mark bye matches
                if (home === 'BYE' || away === 'BYE') {
                    match.bye = true;
                }

                matches.push(match);
            }

            bracket.push(...matches);

            // Prepare next round, automatically advancing teams with byes
            const nextRound = [];
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                if (match.bye) {
                    // Automatically advance the non-bye team
                    const advancingTeam = match.home === 'BYE' ? match.away : match.home;
                    nextRound.push(advancingTeam);
                } else {
                    // Regular match - winner TBD
                    nextRound.push(null);
                }
            }

            currentRound = nextRound;
            roundName = this._getRoundName(currentRound.length);
        }

        return {
            teams: tournamentTeams,
            bracket
        };
    }

    /**
     * Adjust team count for tournament bracket (round up with byes or round down by elimination)
     * @param {Array<string>} teams - Original teams array
     * @returns {Array<string>} Adjusted teams array with byes if needed
     * @private
     */
    #adjustTeamsForBracket(teams) {
        const teamCount = teams.length;

        // Find the nearest powers of 2
        const lowerPowerOf2 = Math.pow(2, Math.floor(Math.log2(teamCount)));
        const upperPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));

        // If already a power of 2, no adjustment needed
        if (teamCount === lowerPowerOf2) {
            return [...teams];
        }

        // Calculate byes needed to reach upper power of 2
        const byesNeeded = upperPowerOf2 - teamCount;
        const halfTeamCount = teamCount * 0.5;

        if (byesNeeded <= halfTeamCount) {
            // Round up: add byes to reach upper power of 2
            const adjustedTeams = [...teams];
            for (let i = 0; i < byesNeeded; i++) {
                adjustedTeams.push('BYE');
            }
            return adjustedTeams;
        } else {
            // Round down: eliminate teams to reach lower power of 2
            return teams.slice(0, lowerPowerOf2);
        }
    }

    /**
     * Get round name based on team count
     * @param {number} teamCount - Number of teams in round
     * @returns {string} Round name
     * @private
     */
    _getRoundName(teamCount) {
        switch (teamCount) {
            case 2:
                return 'final';
            case 4:
                return 'semi';
            case 8:
                return 'quarter';
            case 16:
                return 'round-of-16';
            default:
                return `round-of-${teamCount}`;
        }
    }

    /**
     * Generate knockout bracket for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string|null} leagueId - League identifier
     * @returns {Promise<Object>} Promise resolving to bracket structure
     */
    async getKnockoutBracketForDate(date, leagueId = null) {
        if (!date || typeof date !== 'string') {
            throw new StandingsError('Valid date is required', 400);
        }

        try {
            const seeding = await this.getKnockoutSeeding(date, leagueId);
            return this.generateKnockoutBracket(seeding);
        } catch (error) {
            if (error instanceof StandingsError) {
                throw error;
            }

            throw new StandingsError(`Failed to generate knockout bracket: ${error.message}`, 500);
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
