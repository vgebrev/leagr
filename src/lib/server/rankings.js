import fs from 'fs/promises';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';

const rankingsMutexes = new Map();

const BONUS_MULTIPLIER = 2;

// Hybrid ranking algorithm configuration
const CONFIDENCE_FRACTION = 0.66; // Full confidence at 66% of max appearances
const PULL_STRENGTH = 1.0; // Multiplier for proportional pull below threshold

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
     * Get data path for the current league
     * @returns {string} - Data path
     */
    getDataPath() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing data path');
        }
        return getLeagueDataPath(this.leagueId);
    }

    /**
     * Get rankings file path for the current league
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
                // Below threshold: proportional pull toward minimum
                const gamesNeeded = confidenceThreshold - data.appearances;
                pullFactor = (gamesNeeded / confidenceThreshold) * PULL_STRENGTH;

                // Clamp pullFactor between 0 and 1
                pullFactor = Math.max(0, Math.min(1, pullFactor));

                // Apply proportional pull toward minimum
                weightedAverage = rawAverage - pullFactor * (rawAverage - minAverage);
                hasFullConfidence = false;
            }

            // Calculate ranking points (weighted average * max appearances)
            const rankingPoints = weightedAverage * maxAppearances;

            enhancedPlayers[name] = {
                // Original data
                points: data.points,
                appearances: data.appearances,

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
     * Update rankings by processing new game data
     * @returns {Promise<Object>} - Updated rankings
     */
    async updateRankings() {
        const mutex = this.getRankingsMutex();
        return await mutex.runExclusive(async () => {
            const files = await fs.readdir(this.getDataPath());
            const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

            const rankings = await this.loadRankingsUnsafe(); // Use unsafe version to avoid double-mutex

            for (const file of dateFiles) {
                const date = file.replace('.json', '');
                if (rankings.calculatedDates.includes(date)) continue;

                const raw = await fs.readFile(path.join(this.getDataPath(), file), 'utf-8');
                const { teams, games } = JSON.parse(raw);

                const teamEntries = Object.entries(teams ?? {});
                const rounds = games?.rounds ?? [];
                if (!teamEntries.length || !rounds.length) continue;

                const teamNames = teamEntries.map(([name]) => name);
                const results = this.getMatchResults(rounds);
                const teamStats = this.getTeamStats(teamNames, results);
                const standings = this.getStandings(teamNames, results);

                for (const [teamName, players] of teamEntries) {
                    const matchPoints = teamStats[teamName].points;
                    const bonusPoints = (teamNames.length - standings[teamName]) * BONUS_MULTIPLIER;

                    for (const player of players) {
                        if (!player) continue;

                        if (!rankings.players[player]) {
                            rankings.players[player] = { points: 0, appearances: 0 };
                        }

                        rankings.players[player].points += 1; // attendance
                        rankings.players[player].points += matchPoints;
                        rankings.players[player].points += bonusPoints;
                        rankings.players[player].appearances += 1;
                    }
                }

                rankings.calculatedDates.push(date);
                rankings.lastUpdated = date;
            }

            // Apply hybrid ranking algorithm to the raw data
            const enhancedRankings = this.calculateEnhancedRankings(rankings);

            await this.saveRankingsUnsafe(enhancedRankings); // Use unsafe version to avoid double-mutex
            return enhancedRankings;
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
