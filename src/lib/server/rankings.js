import fs from 'fs/promises';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';

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
     * Update rankings by processing all game data from scratch
     * @returns {Promise<Object>} - Updated rankings
     */
    async updateRankings() {
        const mutex = this.getRankingsMutex();
        return await mutex.runExclusive(async () => {
            const files = await fs.readdir(this.getDataPath());
            const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

            // Load previous rankings to track movement
            const previousRankings = await this.loadRankingsUnsafe();

            // Start fresh each time to ensure data accuracy
            const rankings = {
                lastUpdated: null,
                calculatedDates: [], // Keep for backward compatibility but don't use for limiting
                players: {}
            };

            // Process all date files to build comprehensive ranking details
            for (const file of dateFiles) {
                const date = file.replace('.json', '');

                const raw = await fs.readFile(path.join(this.getDataPath(), file), 'utf-8');
                const { teams, games } = JSON.parse(raw);

                const teamEntries = Object.entries(teams ?? {});
                const rounds = games?.rounds ?? [];
                if (!teamEntries.length || !rounds.length) continue;

                const teamNames = teamEntries.map(([name]) => name);
                const results = this.getMatchResults(rounds);
                const teamStats = this.getTeamStats(teamNames, results);
                const standings = this.getStandings(teamNames, results);

                // Calculate knockout points
                const knockoutBracket = games?.['knockout-games']?.bracket;
                const playerKnockoutWins = this.getKnockoutPoints(knockoutBracket, teams);

                for (const [teamName, players] of teamEntries) {
                    const matchPoints = teamStats[teamName].points;
                    const bonusPoints = (teamNames.length - standings[teamName]) * BONUS_MULTIPLIER;

                    for (const player of players) {
                        if (!player) continue;

                        if (!rankings.players[player]) {
                            rankings.players[player] = {
                                points: 0,
                                appearances: 0,
                                rankingDetail: {}
                            };
                        }

                        const knockoutWins = playerKnockoutWins[player] || 0;
                        const knockoutPoints = knockoutWins * KNOCKOUT_MULTIPLIER;

                        const appearancePoints = 1;
                        const totalDatePoints =
                            appearancePoints + matchPoints + bonusPoints + knockoutPoints;

                        // Store detailed breakdown for this date
                        rankings.players[player].rankingDetail[date] = {
                            team: teamName,
                            appearancePoints,
                            matchPoints,
                            bonusPoints,
                            knockoutPoints,
                            totalPoints: totalDatePoints
                        };

                        // Update totals
                        rankings.players[player].points += totalDatePoints;
                        rankings.players[player].appearances += 1;
                    }
                }

                rankings.calculatedDates.push(date);
                rankings.lastUpdated = date;
            }

            // Apply hybrid ranking algorithm to the raw data
            const enhancedRankings = this.calculateEnhancedRankings(rankings);

            // Add movement data by comparing with previous rankings
            this.calculateMovementData(enhancedRankings, previousRankings);

            await this.saveRankingsUnsafe(enhancedRankings); // Use the unsafe version to avoid double-mutex
            return enhancedRankings;
        });
    }

    /**
     * Calculate movement data by comparing current and previous rankings
     * @param {Object} currentRankings - Current enhanced rankings
     * @param {Object} previousRankings - Previous rankings data
     */
    calculateMovementData(currentRankings, previousRankings) {
        // If no previous rankings exist, everyone is new
        if (!previousRankings || !previousRankings.players) {
            Object.values(currentRankings.players).forEach((player) => {
                player.previousRank = null;
                player.rankMovement = 0;
                player.isNew = true;
            });
            return;
        }

        // Compare ranks between current and previous
        Object.entries(currentRankings.players).forEach(([playerName, currentData]) => {
            const previousData = previousRankings.players[playerName];

            if (!previousData || typeof previousData.rank !== 'number') {
                // New player
                currentData.previousRank = null;
                currentData.rankMovement = 0;
                currentData.isNew = true;
            } else {
                // Existing player - calculate movement
                currentData.previousRank = previousData.rank;
                // Movement is negative when rank improves (goes down in number)
                currentData.rankMovement = previousData.rank - currentData.rank;
                currentData.isNew = false;
            }
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
}

/**
 * Create a new RankingsManager instance
 * @returns {RankingsManager}
 */
export function createRankingsManager() {
    return new RankingsManager();
}
