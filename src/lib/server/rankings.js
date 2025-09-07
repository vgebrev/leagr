import fs from 'fs/promises';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';
import { createStandingsManager } from './standings.js';
import { createDisciplineManager } from './discipline.js';
import * as fuzzball from 'fuzzball';

const rankingsMutexes = new Map();

const BONUS_MULTIPLIER = 2;
const KNOCKOUT_MULTIPLIER = 4;

// Hybrid ranking algorithm configuration
const CONFIDENCE_FRACTION = 0.66; // Full confidence at 66% of max appearances
const PULL_STRENGTH = 1.0; // Multiplier for proportional pull below the threshold

// ELO rating configuration
const ELO_BASELINE_RATING = 1000;
const ELO_K_LEAGUE = 10;
const ELO_K_CUP = 7;
const ELO_DECAY_RATE = 0.02; // 2% per week
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

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
     * Check if session has any completed games (games with scores)
     * @param {Object} sessionData - Session data containing games
     * @returns {boolean} - True if there are completed games
     */
    hasCompletedGames(sessionData) {
        const { games } = sessionData;
        const rounds = games?.rounds ?? [];

        // Check league games
        for (const round of rounds) {
            for (const game of round) {
                const { homeScore, awayScore } = game;
                if (homeScore !== null && awayScore !== null) {
                    return true;
                }
            }
        }

        // Check knockout games
        const knockoutBracket = games?.['knockout-games']?.bracket;
        if (knockoutBracket && Array.isArray(knockoutBracket)) {
            for (const match of knockoutBracket) {
                if (match.homeScore !== null && match.awayScore !== null) {
                    return true;
                }
            }
        }

        return false;
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
                if (homeScore !== null && awayScore !== null) {
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
            // Skip games with teams that aren't in the current teams list (from team regeneration)
            if (!stats[home] || !stats[away]) {
                continue;
            }

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

        // Process each knockout match (completed games and bye matches)
        for (const match of knockoutBracket) {
            let winner = null;

            if (match.bye) {
                // Bye match: automatically advance the non-bye team
                winner = match.home === 'BYE' ? match.away : match.home;
            } else if (match.homeScore !== null && match.awayScore !== null) {
                // Regular completed match: determine winner by score
                if (match.homeScore > match.awayScore) {
                    winner = match.home;
                } else if (match.awayScore > match.homeScore) {
                    winner = match.away;
                }
                // No points for draws in knockout (shouldn't happen)
            }

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

        return playerKnockoutWins;
    }

    /**
     * Process ELO ratings for all games in a session
     * @param {Map} playerTracker - Map of all player data
     * @param {Object} teams - Teams data with player lists
     * @param {Array} rounds - Game rounds data
     * @param {Array} knockoutBracket - Knockout tournament bracket
     * @param {string} date - Current session date
     */
    processEloRatings(playerTracker, teams, rounds, knockoutBracket, date) {
        // Apply ELO decay to all players before processing games for this date
        this.applyEloDecayToAllPlayers(playerTracker, date);

        // Process ELO ratings for league games
        for (const round of rounds) {
            for (const game of round) {
                const { home, away, homeScore, awayScore } = game;
                if (homeScore !== null && awayScore !== null) {
                    const homeTeam = teams[home] || [];
                    const awayTeam = teams[away] || [];
                    this.updateEloRatingsForGame(
                        playerTracker,
                        homeTeam,
                        awayTeam,
                        homeScore,
                        awayScore,
                        'league'
                    );
                }
            }
        }

        // Process ELO ratings for knockout games
        if (knockoutBracket && Array.isArray(knockoutBracket)) {
            for (const match of knockoutBracket) {
                if (match.homeScore !== null && match.awayScore !== null) {
                    const homeTeam = teams[match.home] || [];
                    const awayTeam = teams[match.away] || [];
                    this.updateEloRatingsForGame(
                        playerTracker,
                        homeTeam,
                        awayTeam,
                        match.homeScore,
                        match.awayScore,
                        'cup'
                    );
                }
            }
        }
    }

    /**
     * Calculate expected score for team A vs team B in ELO system
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
     * Calculate team average ELO rating from player ratings
     * @param {string[]} players - Array of player names (may contain nulls)
     * @param {Object} playerRatings - Player rankings data
     * @returns {number} - Average ELO rating of team (ignoring nulls)
     */
    calculateTeamEloRating(players, playerRatings) {
        const validPlayers = players.filter((player) => player !== null && player !== undefined);
        if (validPlayers.length === 0) return ELO_BASELINE_RATING;

        const totalRating = validPlayers.reduce((sum, player) => {
            const playerData = playerRatings[player];
            const eloData = playerData?.elo || { rating: ELO_BASELINE_RATING };
            return sum + eloData.rating;
        }, 0);

        return totalRating / validPlayers.length;
    }

    /**
     * Apply weekly decay to a player's ELO rating
     * @param {number} currentRating - Current player rating
     * @param {number} weeksElapsed - Number of whole weeks since last decay
     * @returns {number} - New rating after decay
     */
    applyEloDecay(currentRating, weeksElapsed) {
        if (weeksElapsed <= 0) return currentRating;

        const decayFactor = Math.pow(1 - ELO_DECAY_RATE, weeksElapsed);
        return ELO_BASELINE_RATING + (currentRating - ELO_BASELINE_RATING) * decayFactor;
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
        return Math.floor(msElapsed / MS_PER_WEEK);
    }

    /**
     * Update player ELO ratings based on game result
     * @param {Object} playerTracker - Map of all player data
     * @param {string[]} homeTeam - Home team player names
     * @param {string[]} awayTeam - Away team player names
     * @param {number} homeScore - Home team score
     * @param {number} awayScore - Away team score
     * @param {string} phase - Game phase ('league' or cup-related)
     */
    updateEloRatingsForGame(playerTracker, homeTeam, awayTeam, homeScore, awayScore, phase) {
        // Filter out null players
        const homePlayersValid = homeTeam.filter((p) => p !== null && p !== undefined);
        const awayPlayersValid = awayTeam.filter((p) => p !== null && p !== undefined);

        if (homePlayersValid.length === 0 || awayPlayersValid.length === 0) {
            return; // Skip games with no valid players
        }

        // Ensure all players exist and have ELO data
        [...homePlayersValid, ...awayPlayersValid].forEach((playerName) => {
            if (!playerTracker.has(playerName)) {
                playerTracker.set(playerName, {
                    points: 0,
                    appearances: 0,
                    rankingDetail: {}
                });
            }

            const playerData = playerTracker.get(playerName);
            if (!playerData.elo) {
                playerData.elo = {
                    rating: ELO_BASELINE_RATING,
                    lastDecayAt: null,
                    gamesPlayed: 0
                };
            }
        });

        // Convert playerTracker to simple object for rating calculation
        const playerRatings = {};
        playerTracker.forEach((data, name) => {
            playerRatings[name] = data;
        });

        // Calculate team ratings
        const homeRating = this.calculateTeamEloRating(homeTeam, playerRatings);
        const awayRating = this.calculateTeamEloRating(awayTeam, playerRatings);

        // Calculate expected scores
        const homeExpected = this.calculateExpectedScore(homeRating, awayRating);
        const awayExpected = 1 - homeExpected;

        // Calculate actual scores
        const homeActual = this.calculateActualScore(homeScore, awayScore);
        const awayActual = 1 - homeActual;

        // Determine K factor based on phase
        const kFactor = phase === 'league' ? ELO_K_LEAGUE : ELO_K_CUP;

        // Update home team players
        homePlayersValid.forEach((playerName) => {
            const playerData = playerTracker.get(playerName);
            playerData.elo.rating += kFactor * (homeActual - homeExpected);
            playerData.elo.gamesPlayed++;
        });

        // Update away team players
        awayPlayersValid.forEach((playerName) => {
            const playerData = playerTracker.get(playerName);
            playerData.elo.rating += kFactor * (awayActual - awayExpected);
            playerData.elo.gamesPlayed++;
        });
    }

    /**
     * Apply ELO decay to all players since their last decay date
     * @param {Map} playerTracker - Map of all player data
     * @param {string} currentDate - Current session date (YYYY-MM-DD)
     */
    applyEloDecayToAllPlayers(playerTracker, currentDate) {
        playerTracker.forEach((playerData) => {
            if (!playerData.elo) {
                playerData.elo = {
                    rating: ELO_BASELINE_RATING,
                    lastDecayAt: null,
                    gamesPlayed: 0
                };
                return;
            }

            let lastDecayDate = playerData.elo.lastDecayAt;

            // If never decayed before, use their first session date as the baseline
            if (!lastDecayDate) {
                const rankingDetailDates = Object.keys(playerData.rankingDetail || {}).sort();
                if (rankingDetailDates.length > 0) {
                    lastDecayDate = rankingDetailDates[0]; // First session date
                } else {
                    // No ranking detail yet, use current date (no decay)
                    lastDecayDate = currentDate;
                }
            }

            const weeksElapsed = this.calculateWeeksElapsed(lastDecayDate, currentDate);

            if (weeksElapsed > 0) {
                playerData.elo.rating = this.applyEloDecay(playerData.elo.rating, weeksElapsed);
                playerData.elo.lastDecayAt = currentDate;
            }
        });
    }

    /**
     * Find the last appearance date for a player (last ranking detail where they scored points)
     * @param {Object} rankingDetail - Player's ranking detail object
     * @returns {string|null} - Last appearance date (YYYY-MM-DD) or null if no appearances
     */
    findLastAppearance(rankingDetail) {
        if (!rankingDetail || Object.keys(rankingDetail).length === 0) {
            return null;
        }

        // Get all dates where player appeared and scored points, sorted chronologically
        const appearanceDates = Object.keys(rankingDetail)
            .filter((date) => {
                const detail = rankingDetail[date];
                // Player appeared if they have a team and scored any points
                return detail && detail.team && detail.totalPoints > 0;
            })
            .sort();

        return appearanceDates.length > 0 ? appearanceDates[appearanceDates.length - 1] : null;
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

            // Find last appearance date (last ranking detail with points scored)
            const lastAppearance = this.findLastAppearance(data.rankingDetail || {});

            enhancedPlayers[name] = {
                // Original data
                points: data.points,
                appearances: data.appearances,
                rankingDetail: data.rankingDetail || {},

                // ELO data
                elo: data.elo || null,

                // Activity tracking
                lastAppearance: lastAppearance,

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

        // Sort by ranking points (descending), with total points and ELO as tiebreakers
        playersArray.sort((a, b) => {
            if (b[1].rankingPoints !== a[1].rankingPoints) {
                return b[1].rankingPoints - a[1].rankingPoints;
            }
            if (b[1].points !== a[1].points) {
                return b[1].points - a[1].points;
            }
            // Tertiary tiebreaker: ELO rating
            const aElo = a[1].elo?.rating || ELO_BASELINE_RATING;
            const bElo = b[1].elo?.rating || ELO_BASELINE_RATING;
            return bElo - aElo;
        });

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

                const raw = await fs.readFile(path.join(this.getDataPath(), file), 'utf-8');
                const sessionData = JSON.parse(raw);
                const { teams, games } = sessionData;

                const teamEntries = Object.entries(teams ?? {});
                const rounds = games?.rounds ?? [];

                // Skip dates with no completed games - don't add to calculatedDates and don't process rankings
                if (!teamEntries.length || !rounds.length || !this.hasCompletedGames(sessionData)) {
                    continue;
                }

                // Only add to calculatedDates if we're actually processing this date
                allCalculatedDates.push(date);

                // Process game data for this date
                const teamNames = teamEntries.map(([name]) => name);
                const results = this.getMatchResults(rounds);
                const teamStats = this.getTeamStats(teamNames, results);
                const standings = this.getStandings(teamNames, results);
                const knockoutBracket = games?.['knockout-games']?.bracket;
                const playerKnockoutWins = this.getKnockoutPoints(knockoutBracket, teams);

                // Process ELO ratings for all games in this session
                this.processEloRatings(playerTracker, teams, rounds, knockoutBracket, date);

                // Track players who appeared this date
                const playersWhoAppeared = new Set();

                // Update player data for those who appeared
                for (const [teamName, players] of teamEntries) {
                    const matchPoints = teamStats[teamName].points;
                    const bonusPoints =
                        (teamNames.length - 1 - standings[teamName]) * BONUS_MULTIPLIER;

                    for (const player of players) {
                        if (!player) continue;

                        playersWhoAppeared.add(player);

                        // Initialize player if first appearance
                        if (!playerTracker.has(player)) {
                            playerTracker.set(player, {
                                points: 0,
                                appearances: 0,
                                rankingDetail: {},
                                elo: {
                                    rating: ELO_BASELINE_RATING,
                                    lastDecayAt: null,
                                    gamesPlayed: 0
                                }
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
                            totalPoints: totalDatePoints,
                            eloRating: playerData.elo
                                ? Math.round(playerData.elo.rating)
                                : ELO_BASELINE_RATING
                        };

                        // Add championship flags
                        this.addChampionshipFlags(playerData.rankingDetail[date], sessionData);

                        // Update cumulative totals
                        playerData.points += totalDatePoints;
                        playerData.appearances += 1;
                    }
                }

                // Clear active no-shows for players who appeared after their latest no-show
                // Only do this if discipline system is enabled
                if (
                    playersWhoAppeared.size > 0 &&
                    sessionData.settings?.discipline?.enabled !== false
                ) {
                    const disciplineManager = createDisciplineManager().setLeague(this.leagueId);
                    for (const player of playersWhoAppeared) {
                        try {
                            await disciplineManager.clearNoShowsIfAppeared(player, date);
                        } catch (error) {
                            // Log but don't fail rankings update if discipline clearing fails
                            console.error(
                                `Failed to clear no-shows for player ${player} on date ${date}:`,
                                error
                            );
                        }
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
                        totalPoints: null,
                        eloRating: playerData.elo
                            ? Math.round(playerData.elo.rating)
                            : ELO_BASELINE_RATING
                    };
                } else {
                    // Player appeared but entry wasn't created yet (edge case)
                    playerData.rankingDetail[date] = {
                        eloRating: playerData.elo
                            ? Math.round(playerData.elo.rating)
                            : ELO_BASELINE_RATING
                    };
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

    /**
     * Check if a player name is similar to any existing ranked players (fuzzy matching)
     * @param {string} playerName - Player name to check
     * @param {number} threshold - Similarity threshold (0-100, default 80)
     * @returns {Promise<Object>} - Similar player match result
     */
    async checkSimilarRankedPlayer(playerName, threshold = 80) {
        const rankings = await this.loadRankings();
        const rankedPlayerNames = Object.keys(rankings.players || {});

        for (const rankedPlayerName of rankedPlayerNames) {
            // Calculate similarity between the input name and ranked player name
            const similarity = fuzzball.ratio(
                playerName.toLowerCase().trim(),
                rankedPlayerName.toLowerCase().trim()
            );

            // Only suggest if similarity is high but not 100% (exact match)
            // This helps with typos but doesn't suggest for exact matches
            if (similarity >= threshold && similarity < 100) {
                return {
                    hasSimilar: true,
                    suggestedPlayer: rankedPlayerName,
                    similarity: similarity
                };
            }
        }

        return { hasSimilar: false };
    }
}

/**
 * Create a new RankingsManager instance
 * @returns {RankingsManager}
 */
export function createRankingsManager() {
    return new RankingsManager();
}
