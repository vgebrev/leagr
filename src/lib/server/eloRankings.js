import fs from 'fs/promises';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';

const eloMutexes = new Map();

/**
 * @typedef {Object} EloPlayerData
 * @property {number} rating - Current Elo rating
 * @property {string|null} lastDecayAt - Last date decay was applied (YYYY-MM-DD format)
 * @property {number} gamesPlayed - Total games participated in
 * @property {number} sessionsPlayed - Total sessions participated in
 * @property {string|null} lastPlayedAt - Last date player participated (YYYY-MM-DD format)
 */

/**
 * @typedef {Object} EloRankingsData
 * @property {Object.<string, EloPlayerData>} players - Map of playerId to player data
 * @property {string|null} lastUpdated - Last session date processed
 * @property {string[]} processedSessions - List of session dates that have been processed
 */

/**
 * Server-side Elo rankings management service
 */
export class EloRankingsManager {
    constructor() {
        this.leagueId = null;
        this.BASELINE_RATING = 1000;
        this.K_LEAGUE = 10;
        this.K_CUP = 7;
        this.DECAY_RATE = 0.02; // 2% per week
        this.MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    }

    /**
     * Set the league ID for this manager instance
     * @param {string} leagueId - League identifier
     * @returns {EloRankingsManager} - Fluent interface
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
     * Get the Elo rankings file path for the current league
     * @returns {string} - Elo rankings file path
     */
    getEloRankingsPath() {
        return path.join(this.getDataPath(), 'elo-rankings.json');
    }

    /**
     * Get mutex for the current league
     * @returns {Mutex} - League-specific mutex
     */
    getEloMutex() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing mutex');
        }
        if (!eloMutexes.has(this.leagueId)) {
            eloMutexes.set(this.leagueId, new Mutex());
        }
        return eloMutexes.get(this.leagueId);
    }

    /**
     * Load Elo rankings without mutex protection (internal use)
     * @returns {Promise<EloRankingsData>} - Raw Elo rankings data
     */
    async loadEloRankingsUnsafe() {
        try {
            const raw = await fs.readFile(this.getEloRankingsPath(), 'utf-8');
            return JSON.parse(raw);
        } catch {
            return {
                players: {},
                lastUpdated: null,
                processedSessions: []
            };
        }
    }

    /**
     * Load Elo rankings with mutex protection
     * @returns {Promise<EloRankingsData>} - Raw Elo rankings data
     */
    async loadEloRankings() {
        const mutex = this.getEloMutex();
        return await mutex.runExclusive(async () => {
            return await this.loadEloRankingsUnsafe();
        });
    }

    /**
     * Save Elo rankings without mutex protection (internal use)
     * @param {EloRankingsData} rankings - Rankings data to save
     * @returns {Promise<void>}
     */
    async saveEloRankingsUnsafe(rankings) {
        await fs.writeFile(this.getEloRankingsPath(), JSON.stringify(rankings, null, 2));
    }

    /**
     * Save Elo rankings with mutex protection
     * @param {EloRankingsData} rankings - Rankings data to save
     * @returns {Promise<void>}
     */
    async saveEloRankings(rankings) {
        const mutex = this.getEloMutex();
        return await mutex.runExclusive(async () => {
            return await this.saveEloRankingsUnsafe(rankings);
        });
    }

    /**
     * Initialize a new player with default values
     * @param {string} playerId - Player identifier
     * @returns {EloPlayerData} - New player data
     */
    createNewPlayer() {
        return {
            rating: this.BASELINE_RATING,
            lastDecayAt: null,
            gamesPlayed: 0,
            sessionsPlayed: 0,
            lastPlayedAt: null
        };
    }

    /**
     * Ensure player exists in rankings with default values if not present
     * @param {EloRankingsData} rankings - Rankings data
     * @param {string} playerId - Player identifier
     */
    ensurePlayerExists(rankings, playerId) {
        if (!rankings.players[playerId]) {
            rankings.players[playerId] = this.createNewPlayer(playerId);
        }
    }

    /**
     * Calculate expected score for team A vs team B
     * @param {number} ratingA - Team A average rating
     * @param {number} ratingB - Team B average rating
     * @returns {number} - Expected score for team A (0-1)
     */
    calculateExpectedScore(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }

    /**
     * Calculate actual score based on game result
     * @param {number} homeScore - Home team score
     * @param {number} awayScore - Away team score
     * @returns {number} - Actual score for home team (0, 0.5, or 1)
     */
    calculateActualScore(homeScore, awayScore) {
        if (homeScore > awayScore) return 1;
        if (homeScore < awayScore) return 0;
        return 0.5; // Draw
    }

    /**
     * Calculate team average rating from player ratings
     * @param {string[]} players - Array of player IDs (may contain nulls)
     * @param {Object.<string, EloPlayerData>} playerRatings - Player ratings map
     * @returns {number} - Average rating of team (ignoring nulls)
     */
    calculateTeamRating(players, playerRatings) {
        const validPlayers = players.filter((player) => player !== null && player !== undefined);
        if (validPlayers.length === 0) return this.BASELINE_RATING;

        const totalRating = validPlayers.reduce((sum, player) => {
            const playerData = playerRatings[player] || { rating: this.BASELINE_RATING };
            return sum + playerData.rating;
        }, 0);

        return totalRating / validPlayers.length;
    }

    /**
     * Apply weekly decay to a player's rating
     * @param {number} currentRating - Current player rating
     * @param {number} weeksElapsed - Number of whole weeks since last decay
     * @returns {number} - New rating after decay
     */
    applyDecay(currentRating, weeksElapsed) {
        if (weeksElapsed <= 0) return currentRating;

        const decayFactor = Math.pow(1 - this.DECAY_RATE, weeksElapsed);
        return this.BASELINE_RATING + (currentRating - this.BASELINE_RATING) * decayFactor;
    }

    /**
     * Calculate weeks elapsed between two dates
     * @param {string} fromDate - Start date (YYYY-MM-DD)
     * @param {string} toDate - End date (YYYY-MM-DD)
     * @returns {number} - Whole weeks elapsed
     */
    calculateWeeksElapsed(fromDate, toDate) {
        const fromMs = new Date(fromDate).getTime();
        const toMs = new Date(toDate).getTime();
        const msElapsed = toMs - fromMs;
        return Math.floor(msElapsed / this.MS_PER_WEEK);
    }

    /**
     * Apply decay to all players since their last decay date
     * @param {EloRankingsData} rankings - Rankings data to modify
     * @param {string} currentDate - Current session date (YYYY-MM-DD)
     */
    applyDecayToAllPlayers(rankings, currentDate) {
        for (const [, playerData] of Object.entries(rankings.players)) {
            const lastDecayDate =
                playerData.lastDecayAt || rankings.processedSessions[0] || currentDate;
            const weeksElapsed = this.calculateWeeksElapsed(lastDecayDate, currentDate);

            if (weeksElapsed > 0) {
                playerData.rating = this.applyDecay(playerData.rating, weeksElapsed);
                playerData.lastDecayAt = currentDate;
            }
        }
    }

    /**
     * Update player ratings based on game result
     * @param {EloRankingsData} rankings - Rankings data to modify
     * @param {string[]} homeTeam - Home team player IDs
     * @param {string[]} awayTeam - Away team player IDs
     * @param {number} homeScore - Home team score
     * @param {number} awayScore - Away team score
     * @param {string} phase - Game phase ('league' or cup-related)
     */
    updateRatingsForGame(rankings, homeTeam, awayTeam, homeScore, awayScore, phase) {
        // Filter out null players
        const homePlayersValid = homeTeam.filter((p) => p !== null && p !== undefined);
        const awayPlayersValid = awayTeam.filter((p) => p !== null && p !== undefined);

        if (homePlayersValid.length === 0 || awayPlayersValid.length === 0) {
            return; // Skip games with no valid players
        }

        // Ensure all players exist
        [...homePlayersValid, ...awayPlayersValid].forEach((playerId) => {
            this.ensurePlayerExists(rankings, playerId);
        });

        // Calculate team ratings
        const homeRating = this.calculateTeamRating(homeTeam, rankings.players);
        const awayRating = this.calculateTeamRating(awayTeam, rankings.players);

        // Calculate expected scores
        const homeExpected = this.calculateExpectedScore(homeRating, awayRating);
        const awayExpected = 1 - homeExpected;

        // Calculate actual scores
        const homeActual = this.calculateActualScore(homeScore, awayScore);
        const awayActual = 1 - homeActual;

        // Determine K factor based on phase
        const kFactor = phase === 'league' ? this.K_LEAGUE : this.K_CUP;

        // Update home team players
        homePlayersValid.forEach((playerId) => {
            const player = rankings.players[playerId];
            player.rating += kFactor * (homeActual - homeExpected);
            player.gamesPlayed++;
        });

        // Update away team players
        awayPlayersValid.forEach((playerId) => {
            const player = rankings.players[playerId];
            player.rating += kFactor * (awayActual - awayExpected);
            player.gamesPlayed++;
        });
    }

    /**
     * Get all session dates that have game data, sorted chronologically
     * @returns {Promise<string[]>} - Array of session dates (YYYY-MM-DD)
     */
    async getAllSessionDates() {
        const files = await fs.readdir(this.getDataPath());
        const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
        return dateFiles.map((f) => f.replace('.json', '')).sort();
    }

    /**
     * Check if a session has any completed games
     * @param {Object} sessionData - Session data
     * @returns {boolean} - True if session has completed games
     */
    hasCompletedGames(sessionData) {
        const { games } = sessionData;

        // Check league games
        const rounds = games?.rounds ?? [];
        for (const round of rounds) {
            if (Array.isArray(round)) {
                for (const game of round) {
                    if (game.homeScore !== null && game.awayScore !== null) {
                        return true;
                    }
                }
            }
        }

        // Check cup games
        const cupGames = games?.cup ?? [];
        for (const game of cupGames) {
            if (game.homeScore !== null && game.awayScore !== null) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get players who participated in a specific session
     * @param {string} sessionDate - Session date (YYYY-MM-DD)
     * @returns {Promise<Set<string>>} - Set of player IDs who participated
     */
    async getSessionParticipants(sessionDate) {
        try {
            const sessionPath = path.join(this.getDataPath(), `${sessionDate}.json`);
            const raw = await fs.readFile(sessionPath, 'utf-8');
            const sessionData = JSON.parse(raw);

            if (!this.hasCompletedGames(sessionData)) {
                return new Set(); // No completed games = no participants for Elo purposes
            }

            const participants = new Set();
            const teams = sessionData.teams || {};

            // Add all players from teams that played
            Object.values(teams).forEach((team) => {
                if (Array.isArray(team)) {
                    team.forEach((player) => {
                        if (player !== null && player !== undefined) {
                            participants.add(player);
                        }
                    });
                }
            });

            return participants;
        } catch {
            return new Set(); // File doesn't exist or error reading
        }
    }

    /**
     * Build attendance index for recent sessions based on percentage of total sessions
     * @param {string} beforeDate - Reference date (YYYY-MM-DD)
     * @param {number} percentage - Percentage of total sessions to consider (default 1.0 = 100%)
     * @returns {Promise<Object.<string, number>>} - Map of playerId to attendance count
     */
    async buildAttendanceIndex(beforeDate, percentage = 1.0) {
        const allSessions = await this.getAllSessionDates();
        const sessionsBefore = allSessions.filter((date) => date < beforeDate);

        // Calculate how many recent sessions to consider (minimum 1, maximum all sessions)
        const sessionCount = Math.max(1, Math.floor(sessionsBefore.length * percentage));
        const recentSessions = sessionsBefore.slice(-sessionCount);

        const attendanceMap = {};

        for (const sessionDate of recentSessions) {
            const participants = await this.getSessionParticipants(sessionDate);
            participants.forEach((playerId) => {
                attendanceMap[playerId] = (attendanceMap[playerId] || 0) + 1;
            });
        }

        return { attendanceMap, sessionCount };
    }

    /**
     * Calculate seeding score for a player based on activity gate
     * @param {string} playerId - Player identifier
     * @param {EloPlayerData} playerData - Player's Elo data
     * @param {string} forDate - Date to calculate seeding for (YYYY-MM-DD)
     * @param {number} percentage - Percentage of recent sessions to consider (default 1.0)
     * @param {number} leagueMinRating - Minimum rating in the league (for pulling inactive players)
     * @returns {Promise<number>} - Seeding score for team generation
     */
    async calculateSeedingScore(playerId, playerData, forDate, percentage = 1.0, leagueMinRating = null) {
        const { attendanceMap } = await this.buildAttendanceIndex(forDate, percentage);
        const playedRecently = attendanceMap[playerId] || 0;

        // Find the maximum sessions played by any player (for activity gate calculation)
        const maxSessionsPlayed = Math.max(...Object.values(attendanceMap), 0);
        const activityFactor = maxSessionsPlayed > 0 ? playedRecently / maxSessionsPlayed : 0; // 0..1

        // Use league minimum rating if provided, otherwise fall back to baseline
        const pullTowardRating = leagueMinRating !== null ? leagueMinRating : this.BASELINE_RATING;

        return pullTowardRating + activityFactor * (playerData.rating - pullTowardRating);
    }

    /**
     * Get seeding scores for all players for team generation
     * @param {string} forDate - Date to calculate seeding for (YYYY-MM-DD)
     * @param {number} percentage - Percentage of recent sessions to consider (default 1.0)
     * @returns {Promise<Object.<string, number>>} - Map of playerId to seeding score
     */
    async getAllSeedingScores(forDate, percentage = 1.0) {
        const rankings = await this.loadEloRankings();
        const seedingScores = {};

        // Find the minimum rating in the league
        const playerRatings = Object.values(rankings.players).map(p => p.rating);
        const leagueMinRating = playerRatings.length > 0 ? Math.min(...playerRatings) : this.BASELINE_RATING;

        for (const [playerId, playerData] of Object.entries(rankings.players)) {
            seedingScores[playerId] = await this.calculateSeedingScore(
                playerId,
                playerData,
                forDate,
                percentage,
                leagueMinRating
            );
        }

        return seedingScores;
    }

    /**
     * Process a single session and update Elo rankings
     * @param {string} sessionDate - Session date (YYYY-MM-DD)
     * @returns {Promise<EloRankingsData>} - Updated rankings data
     */
    async processSession(sessionDate) {
        const mutex = this.getEloMutex();
        return await mutex.runExclusive(async () => {
            const rankings = await this.loadEloRankingsUnsafe();

            // Check if session already processed (idempotency)
            if (rankings.processedSessions.includes(sessionDate)) {
                return rankings; // Already processed, return unchanged
            }

            // Load session data
            const sessionPath = path.join(this.getDataPath(), `${sessionDate}.json`);
            let sessionData;
            try {
                const raw = await fs.readFile(sessionPath, 'utf-8');
                sessionData = JSON.parse(raw);
            } catch {
                return rankings; // Session file doesn't exist or can't be read
            }

            // Skip if no completed games
            if (!this.hasCompletedGames(sessionData)) {
                return rankings; // No games to process
            }

            // Apply decay to all known players before processing games
            this.applyDecayToAllPlayers(rankings, sessionDate);

            // Process league games
            const rounds = sessionData.games?.rounds ?? [];
            for (const round of rounds) {
                if (Array.isArray(round)) {
                    for (const game of round) {
                        if (game.homeScore !== null && game.awayScore !== null) {
                            const homeTeam = sessionData.teams[game.home] || [];
                            const awayTeam = sessionData.teams[game.away] || [];
                            this.updateRatingsForGame(
                                rankings,
                                homeTeam,
                                awayTeam,
                                game.homeScore,
                                game.awayScore,
                                'league'
                            );
                        }
                    }
                }
            }

            // Process cup games
            const cupGames = sessionData.games?.cup ?? [];
            for (const game of cupGames) {
                if (game.homeScore !== null && game.awayScore !== null) {
                    const homeTeam = sessionData.teams[game.home] || [];
                    const awayTeam = sessionData.teams[game.away] || [];
                    const phase = game.phase || 'cup';
                    this.updateRatingsForGame(
                        rankings,
                        homeTeam,
                        awayTeam,
                        game.homeScore,
                        game.awayScore,
                        phase
                    );
                }
            }

            // Update activity tracking for all participants
            const allParticipants = new Set();
            Object.values(sessionData.teams || {}).forEach((team) => {
                if (Array.isArray(team)) {
                    team.forEach((player) => {
                        if (player !== null && player !== undefined) {
                            allParticipants.add(player);
                        }
                    });
                }
            });

            // Update session participation for all participants
            allParticipants.forEach((playerId) => {
                this.ensurePlayerExists(rankings, playerId);
                const player = rankings.players[playerId];
                player.sessionsPlayed++;
                player.lastPlayedAt = sessionDate;
            });

            // Mark session as processed
            rankings.processedSessions.push(sessionDate);
            rankings.processedSessions.sort(); // Keep chronological order
            rankings.lastUpdated = sessionDate;

            // Save updated rankings
            await this.saveEloRankingsUnsafe(rankings);
            return rankings;
        });
    }

    /**
     * Process all sessions chronologically to build complete Elo rankings
     * @returns {Promise<EloRankingsData>} - Complete updated rankings
     */
    async updateAllEloRankings() {
        const allSessions = await this.getAllSessionDates();
        let rankings = await this.loadEloRankings();

        for (const sessionDate of allSessions) {
            rankings = await this.processSession(sessionDate);
        }

        return rankings;
    }

    /**
     * Get enhanced rankings with additional computed fields for display
     * @param {string} forDate - Date to calculate seed scores for (defaults to today)
     * @param {number} percentage - Percentage of recent sessions for activity gate (default 1.0)
     * @returns {Promise<Object>} - Enhanced rankings with computed fields
     */
    async getEnhancedEloRankings(forDate = null, percentage = 1.0) {
        const rankings = await this.loadEloRankings();
        const currentDate = forDate || new Date().toISOString().split('T')[0];

        // Find the minimum rating in the league for seed score calculation
        const playerRatings = Object.values(rankings.players).map(p => p.rating);
        const leagueMinRating = playerRatings.length > 0 ? Math.min(...playerRatings) : this.BASELINE_RATING;

        // Calculate seed scores for all players
        const seedScores = await this.getAllSeedingScores(currentDate, percentage);

        // Create enhanced player data with seed scores
        const playersWithSeedScores = Object.entries(rankings.players).map(([playerId, data]) => ({
            playerId,
            ...data,
            rating: Math.round(data.rating), // Round for display
            seedScore: Math.round(seedScores[playerId] || leagueMinRating)
        }));

        // Sort players by seed score descending (primary ranking), then by rating
        const sortedPlayers = playersWithSeedScores
            .sort((a, b) => {
                if (b.seedScore !== a.seedScore) return b.seedScore - a.seedScore;
                return b.rating - a.rating;
            })
            .map((player, index) => ({
                ...player,
                rank: index + 1
            }));

        return {
            ...rankings,
            players: sortedPlayers,
            metadata: {
                totalPlayers: sortedPlayers.length,
                averageRating: Math.round(
                    sortedPlayers.reduce((sum, p) => sum + p.rating, 0) / sortedPlayers.length || 0
                ),
                averageSeedScore: Math.round(
                    sortedPlayers.reduce((sum, p) => sum + p.seedScore, 0) / sortedPlayers.length ||
                        0
                ),
                lastUpdated: rankings.lastUpdated,
                processedSessionsCount: rankings.processedSessions.length,
                activityGatePercentage: percentage
            }
        };
    }
}

/**
 * Create a new EloRankingsManager instance
 * @returns {EloRankingsManager}
 */
export function createEloRankingsManager() {
    return new EloRankingsManager();
}
