import fs from 'fs/promises';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';
import { createStandingsManager } from './standings.js';

const rankingsMutexes = new Map();

const BONUS_MULTIPLIER = 2;
const KNOCKOUT_MULTIPLIER = 3;

// Hybrid ranking algorithm configuration
const CONFIDENCE_FRACTION = 0.66; // Full confidence at 66% of max appearances
const PULL_STRENGTH = 1.0; // Multiplier for proportional pull below the threshold

/**
 * Server-side rankings management service
 */
export class RankingsManager {
    constructor() {
        this.leagueId = null;
    }

    /**
     * Set the league ID for this manager instance
     * @param {string} leagueId - League identifier
     * @returns {RankingsManager} - Fluent interface
     */
    setLeague(leagueId) {
        this.leagueId = leagueId;
        return this;
    }

    /**
     * Get the data path for the current league
     * @returns {string} - Data path
     */
    getDataPath() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing data path');
        }
        return getLeagueDataPath(this.leagueId);
    }

    /**
     * Get the Rankings file path for the current league
     * @returns {string} - Rankings file path
     */
    getRankingsPath() {
        return path.join(this.getDataPath(), 'rankings.json');
    }

    /**
     * Get mutex for the current league
     * @returns {Mutex} - League-specific mutex
     */
    getRankingsMutex() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing mutex');
        }
        if (!rankingsMutexes.has(this.leagueId)) {
            rankingsMutexes.set(this.leagueId, new Mutex());
        }
        return rankingsMutexes.get(this.leagueId);
    }

    /**
     * Load rankings without mutex protection (internal use)
     * @returns {Promise<Object>} - Raw rankings data
     */
    async loadRankingsUnsafe() {
        try {
            const raw = await fs.readFile(this.getRankingsPath(), 'utf-8');
            return JSON.parse(raw);
        } catch {
            return {
                lastUpdated: null,
                calculatedDates: [],
                players: {}
            };
        }
    }

    /**
     * Load rankings with mutex protection
     * @returns {Promise<Object>} - Raw rankings data
     */
    async loadRankings() {
        const mutex = this.getRankingsMutex();
        return await mutex.runExclusive(async () => {
            return await this.loadRankingsUnsafe();
        });
    }

    /**
     * Save rankings without mutex protection (internal use)
     * @param {Object} rankings - Rankings data to save
     * @returns {Promise<void>}
     */
    async saveRankingsUnsafe(rankings) {
        await fs.writeFile(this.getRankingsPath(), JSON.stringify(rankings, null, 2));
    }

    /**
     * Extract match results from game rounds
     * @param {Array} rounds - Game rounds data
     * @returns {Array} - Match results
     */
    getMatchResults(rounds) {
        const results = [];
        for (const round of rounds) {
            for (const game of round) {
                const { home, away, homeScore, awayScore } = game;
                if (homeScore != null && awayScore != null) {
                    results.push({ home, away, homeScore, awayScore });
                }
            }
        }
        return results;
    }

    /**
     * Calculate team statistics from match results
     * @param {Array} teamNames - Team names
     * @param {Array} results - Match results
     * @returns {Object} - Team statistics
     */
    getTeamStats(teamNames, results) {
        const stats = {};

        for (const name of teamNames) {
            stats[name] = { points: 0, gf: 0, ga: 0 };
        }

        for (const { home, away, homeScore, awayScore } of results) {
            // Points
            if (homeScore > awayScore) {
                stats[home].points += 3;
            } else if (homeScore < awayScore) {
                stats[away].points += 3;
            } else {
                stats[home].points += 1;
                stats[away].points += 1;
            }

            // Goals
            stats[home].gf += homeScore;
            stats[home].ga += awayScore;

            stats[away].gf += awayScore;
            stats[away].ga += homeScore;
        }

        return stats;
    }

    /**
     * Calculate team standings from match results
     * @param {Array} teamNames - Team names
     * @param {Array} results - Match results
     * @returns {Object} - Team standings
     */
    getStandings(teamNames, results) {
        const stats = this.getTeamStats(teamNames, results);

        const ranked = teamNames.map((name) => ({
            name,
            ...stats[name],
            gd: stats[name].gf - stats[name].ga
        }));

        ranked.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });

        const standings = {};
        ranked.forEach((entry, index) => {
            standings[entry.name] = index;
        });

        return standings;
    }

    /**
     * Calculate knockout points for players based on knockout game results
     * @param {Array} knockoutBracket - Knockout tournament bracket
     * @param {Object} teams - Teams data with player lists
     * @returns {Object} Player knockout wins count
     */
    getKnockoutPoints(knockoutBracket, teams) {
        const playerKnockoutWins = {};

        if (!knockoutBracket || !Array.isArray(knockoutBracket)) {
            return playerKnockoutWins;
        }

        // Process each completed knockout match
        for (const match of knockoutBracket) {
            if (match.homeScore !== null && match.awayScore !== null) {
                let winner = null;

                if (match.homeScore > match.awayScore) {
                    winner = match.home;
                } else if (match.awayScore > match.homeScore) {
                    winner = match.away;
                }
                // No points for draws in knockout (shouldn't happen)

                if (winner && teams[winner]) {
                    // Award knockout win to all players in winning team
                    for (const player of teams[winner]) {
                        if (!player) continue;

                        if (!playerKnockoutWins[player]) {
                            playerKnockoutWins[player] = 0;
                        }
                        playerKnockoutWins[player] += 1;
                    }
                }
            }
        }

        return playerKnockoutWins;
    }

    /**
     * Apply hybrid ranking algorithm to raw player data
     * @param {Object} rawRankings - Rankings with basic points/appearances
     * @returns {Object} Enhanced rankings with calculated fields
     */
    calculateEnhancedRankings(rawRankings) {
        if (!rawRankings || !rawRankings.players || Object.keys(rawRankings.players).length === 0) {
            return {
                ...rawRankings,
                players: {},
                rankingMetadata: {
                    globalAverage: 0,
                    minAverage: 0,
                    maxAppearances: 0,
                    confidenceThreshold: 0,
                    lastCalculated: new Date().toISOString()
                }
            };
        }

        // Step 1: Calculate global statistics
        let totalPoints = 0;
        let totalAppearances = 0;
        let maxAppearances = 0;
        const allAverages = [];

        Object.values(rawRankings.players).forEach((player) => {
            totalPoints += player.points;
            totalAppearances += player.appearances;
            maxAppearances = Math.max(maxAppearances, player.appearances);
            allAverages.push(player.points / player.appearances);
        });

        const globalAverage = totalPoints / totalAppearances;
        const minAverage = Math.min(...allAverages);
        const confidenceThreshold = Math.max(1, Math.round(maxAppearances * CONFIDENCE_FRACTION));

        // Step 2: Calculate enhanced player data
        const enhancedPlayers = {};

        Object.entries(rawRankings.players).forEach(([name, data]) => {
            const rawAverage = data.points / data.appearances;

            let weightedAverage, pullFactor, hasFullConfidence;

            if (data.appearances >= confidenceThreshold) {
                // Above threshold: full confidence (no pull)
                weightedAverage = rawAverage;
                pullFactor = 0;
                hasFullConfidence = true;
            } else {
                // Under threshold: proportional pull toward the minimum
                const gamesNeeded = confidenceThreshold - data.appearances;
                pullFactor = (gamesNeeded / confidenceThreshold) * PULL_STRENGTH;

                // Clamp pullFactor between 0 and 1
                pullFactor = Math.max(0, Math.min(1, pullFactor));

                // Apply proportional pull toward the minimum
                weightedAverage = rawAverage - pullFactor * (rawAverage - minAverage);
                hasFullConfidence = false;
            }

            // Calculate ranking points (weighted average * max appearances)
            const rankingPoints = weightedAverage * maxAppearances;

            enhancedPlayers[name] = {
                // Original data
                points: data.points,
                appearances: data.appearances,
                rankingDetail: data.rankingDetail || {},

                // Calculated averages
                rawAverage: parseFloat(rawAverage.toFixed(2)),
                weightedAverage: parseFloat(weightedAverage.toFixed(2)),

                // New ranking points (primary ranking metric)
                rankingPoints: parseFloat(rankingPoints.toFixed(1)),

                // Metadata for transparency
                pullFactor: parseFloat(pullFactor.toFixed(3)),
                hasFullConfidence: hasFullConfidence,
                gamesUntilFullConfidence: hasFullConfidence
                    ? 0
                    : confidenceThreshold - data.appearances
            };
        });

        // Step 3: Add ranking positions
        const playersArray = Object.entries(enhancedPlayers);

        // Sort by ranking points (descending)
        playersArray.sort((a, b) => b[1].rankingPoints - a[1].rankingPoints);

        // Add rank positions
        playersArray.forEach(([name], index) => {
            enhancedPlayers[name].rank = index + 1;
        });

        return {
            ...rawRankings,
            players: enhancedPlayers,
            rankingMetadata: {
                globalAverage: parseFloat(globalAverage.toFixed(2)),
                minAverage: parseFloat(minAverage.toFixed(2)),
                maxAppearances: maxAppearances,
                confidenceThreshold: confidenceThreshold,
                confidenceFraction: CONFIDENCE_FRACTION,
                pullStrength: PULL_STRENGTH,
                totalPlayers: Object.keys(enhancedPlayers).length,
                lastCalculated: new Date().toISOString()
            }
        };
    }

    /**
     * Update rankings by processing all game data from scratch with complete history tracking
     * @returns {Promise<Object>} - Updated rankings
     */
    async updateRankings() {
        const mutex = this.getRankingsMutex();
        return await mutex.runExclusive(async () => {
            const files = await fs.readdir(this.getDataPath());
            const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(); // Process chronologically

            // Track all players we've seen and their cumulative data
            const playerTracker = new Map();
            const allCalculatedDates = [];

            // Process each date file chronologically
            for (const file of dateFiles) {
                const date = file.replace('.json', '');
                allCalculatedDates.push(date);

                const raw = await fs.readFile(path.join(this.getDataPath(), file), 'utf-8');
                const sessionData = JSON.parse(raw);
                const { teams, games } = sessionData;

                const teamEntries = Object.entries(teams ?? {});
                const rounds = games?.rounds ?? [];

                // Skip dates with no data
                if (!teamEntries.length || !rounds.length) {
                    // Still need to update ranks for existing players (no appearances)
                    this.updateRanksForDate(date, playerTracker, new Set());
                    continue;
                }

                // Process game data for this date
                const teamNames = teamEntries.map(([name]) => name);
                const results = this.getMatchResults(rounds);
                const teamStats = this.getTeamStats(teamNames, results);
                const standings = this.getStandings(teamNames, results);
                const knockoutBracket = games?.['knockout-games']?.bracket;
                const playerKnockoutWins = this.getKnockoutPoints(knockoutBracket, teams);

                // Track players who appeared this date
                const playersWhoAppeared = new Set();

                // Update player data for those who appeared
                for (const [teamName, players] of teamEntries) {
                    const matchPoints = teamStats[teamName].points;
                    const bonusPoints = (teamNames.length - standings[teamName]) * BONUS_MULTIPLIER;

                    for (const player of players) {
                        if (!player) continue;

                        playersWhoAppeared.add(player);

                        // Initialize player if first appearance
                        if (!playerTracker.has(player)) {
                            playerTracker.set(player, {
                                points: 0,
                                appearances: 0,
                                rankingDetail: {}
                            });
                        }

                        const playerData = playerTracker.get(player);
                        const knockoutWins = playerKnockoutWins[player] || 0;
                        const knockoutPoints = knockoutWins * KNOCKOUT_MULTIPLIER;
                        const appearancePoints = 1;
                        const totalDatePoints =
                            appearancePoints + matchPoints + bonusPoints + knockoutPoints;

                        // Store appearance data for this date
                        playerData.rankingDetail[date] = {
                            team: teamName,
                            appearancePoints,
                            matchPoints,
                            bonusPoints,
                            knockoutPoints,
                            totalPoints: totalDatePoints
                        };

                        // Add championship flags
                        this.addChampionshipFlags(playerData.rankingDetail[date], sessionData);

                        // Update cumulative totals
                        playerData.points += totalDatePoints;
                        playerData.appearances += 1;
                    }
                }

                // Calculate and store ranks for all tracked players on this date
                this.updateRanksForDate(date, playerTracker, playersWhoAppeared);
            }

            // Convert tracker to final rankings format
            const rankings = {
                lastUpdated: allCalculatedDates[allCalculatedDates.length - 1] || null,
                calculatedDates: allCalculatedDates,
                players: Object.fromEntries(playerTracker)
            };

            // Apply hybrid ranking algorithm to get final enhanced data
            const enhancedRankings = this.calculateEnhancedRankings(rankings);

            // Calculate movement from complete history
            this.calculateMovementFromHistory(enhancedRankings);

            // Add championship counts to each player
            Object.entries(enhancedRankings.players).forEach(([, playerData]) => {
                const championships = this.countChampionships(playerData.rankingDetail);
                playerData.leagueWins = championships.leagueWins;
                playerData.cupWins = championships.cupWins;
            });

            await this.saveRankingsUnsafe(enhancedRankings);
            return enhancedRankings;
        });
    }

    /**
     * Calculate and store ranks for all tracked players on a specific date
     * @param {string} date - The date to calculate ranks for
     * @param {Map} playerTracker - Map of all player data
     * @param {Set} playersWhoAppeared - Set of players who appeared this date
     */
    updateRanksForDate(date, playerTracker, playersWhoAppeared) {
        // Create snapshot of all players' cumulative data up to this date
        const playersForRanking = {};

        playerTracker.forEach((playerData, playerName) => {
            playersForRanking[playerName] = {
                points: playerData.points,
                appearances: playerData.appearances,
                rankingDetail: {} // Not needed for ranking calculation
            };
        });

        // Calculate enhanced rankings for this snapshot
        const enhancedSnapshot = this.calculateEnhancedRankings({
            players: playersForRanking
        });

        // Store rank and total players count for each player
        Object.entries(enhancedSnapshot.players).forEach(([playerName, data]) => {
            const playerData = playerTracker.get(playerName);

            // Ensure an entry exists for this date
            if (!playerData.rankingDetail[date]) {
                // If player didn't appear this date, create non-appearance entry
                if (!playersWhoAppeared.has(playerName)) {
                    playerData.rankingDetail[date] = {
                        team: null,
                        appearancePoints: null,
                        matchPoints: null,
                        bonusPoints: null,
                        knockoutPoints: null,
                        totalPoints: null
                    };
                } else {
                    // Player appeared but entry wasn't created yet (edge case)
                    playerData.rankingDetail[date] = {};
                }
            }

            // Add rank data to the entry (whether appearance or non-appearance)
            playerData.rankingDetail[date].rank = data.rank;
            playerData.rankingDetail[date].totalPlayers =
                enhancedSnapshot.rankingMetadata.totalPlayers;
            playerData.rankingDetail[date].rankingPoints = data.rankingPoints;
        });
    }

    /**
     * Calculate movement data using complete ranking history
     * @param {Object} enhancedRankings - Enhanced rankings with complete history
     */
    calculateMovementFromHistory(enhancedRankings) {
        Object.entries(enhancedRankings.players).forEach(([, playerData]) => {
            const dates = Object.keys(playerData.rankingDetail).sort();

            if (dates.length < 2) {
                // New player or only one date
                playerData.previousRank = null;
                playerData.rankMovement = 0;
                playerData.isNew = true;
                return;
            }

            // Get the last two dates for movement calculation
            const currentDate = dates[dates.length - 1];
            const previousDate = dates[dates.length - 2];

            const currentRank = playerData.rankingDetail[currentDate].rank;
            const previousRank = playerData.rankingDetail[previousDate].rank;

            playerData.previousRank = previousRank;
            playerData.rankMovement = previousRank - currentRank; // Positive = moved up
            playerData.isNew = false;
        });
    }

    /**
     * Load rankings and ensure they have enhanced data
     * @returns {Promise<Object>} - Enhanced rankings
     */
    async loadEnhancedRankings() {
        const rawRankings = await this.loadRankings();

        // Check if rankings already have enhanced data
        if (rawRankings.rankingMetadata && rawRankings.players) {
            const firstPlayer = Object.values(rawRankings.players)[0];
            if (firstPlayer && typeof firstPlayer.rankingPoints === 'number') {
                // Already enhanced, return as-is
                return rawRankings;
            }
        }

        // Need to enhance the raw data
        return this.calculateEnhancedRankings(rawRankings);
    }

    /**
     * Get the league winner from session data
     * @param {Object} sessionData - Session data containing games and teams
     * @returns {string|null} - Winning team name or null if no winner
     */
    getLeagueWinner(sessionData) {
        if (!sessionData.games?.rounds || !Array.isArray(sessionData.games.rounds)) {
            return null;
        }

        // Flatten rounds to get all matches
        const allMatches = sessionData.games.rounds.flat();

        // Check if we have any completed matches
        const hasCompletedMatches = allMatches.some(
            (match) => match.homeScore !== null && match.awayScore !== null
        );

        if (!hasCompletedMatches) {
            return null;
        }

        try {
            const standingsManager = createStandingsManager();
            const standings = standingsManager.calculateStandings(allMatches);

            // Return the first team (highest points)
            return standings.length > 0 ? standings[0].team : null;
        } catch (error) {
            console.error('Error calculating league winner:', error);
            return null;
        }
    }

    /**
     * Get the cup winner from session data
     * @param {Object} sessionData - Session data containing knockout games
     * @returns {string|null} - Winning team name or null if no winner
     */
    getCupWinner(sessionData) {
        if (!sessionData.games?.['knockout-games']?.bracket) {
            return null;
        }

        const bracket = sessionData.games['knockout-games'].bracket;

        // Find the final match
        const finalMatch = bracket.find((match) => match.round === 'final');

        if (!finalMatch || finalMatch.homeScore === null || finalMatch.awayScore === null) {
            return null;
        }

        // Return winner of final match
        return finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.away;
    }

    /**
     * Add championship flags to a ranking detail entry
     * @param {Object} rankingDetail - Ranking detail entry to modify
     * @param {Object} sessionData - Session data for determining winners
     * @returns {Object} - Modified ranking detail with championship flags
     */
    addChampionshipFlags(rankingDetail, sessionData) {
        const leagueWinner = this.getLeagueWinner(sessionData);
        const cupWinner = this.getCupWinner(sessionData);

        rankingDetail.leagueWinner = rankingDetail.team === leagueWinner;
        rankingDetail.cupWinner = rankingDetail.team === cupWinner;

        return rankingDetail;
    }

    /**
     * Count championships from ranking detail entries
     * @param {Object} rankingDetail - Object containing ranking details by date
     * @returns {Object} - Object with leagueWins and cupWins counts
     */
    countChampionships(rankingDetail) {
        let leagueWins = 0;
        let cupWins = 0;

        Object.values(rankingDetail).forEach((entry) => {
            if (entry.leagueWinner === true) leagueWins++;
            if (entry.cupWinner === true) cupWins++;
        });

        return { leagueWins, cupWins };
    }
}

/**
 * Create a new RankingsManager instance
 * @returns {RankingsManager}
 */
export function createRankingsManager() {
    return new RankingsManager();
}
