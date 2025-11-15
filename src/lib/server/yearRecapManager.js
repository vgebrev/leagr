import fs from 'fs/promises';
import { getLeagueDataPath } from './league.js';
import { createRankingsManager } from './rankings.js';
import { createAvatarManager } from './avatarManager.js';

/**
 * Year Recap Manager - Handles aggregation and calculation of yearly statistics
 */
export class YearRecapManager {
    constructor() {
        this.leagueId = null;
    }

    /**
     * Set the league ID for this manager instance
     * @param {string} leagueId - League identifier
     * @returns {YearRecapManager} - Fluent interface
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
     * Load all session files for a given year
     * @param {number} year - Year to load sessions for
     * @returns {Promise<Array>} - Array of session objects with date and data
     */
    async loadYearSessions(year) {
        const rankingsManager = createRankingsManager().setLeague(this.leagueId);
        const dataPath = this.getDataPath();
        const allFiles = await fs.readdir(dataPath);
        const sessionFiles = rankingsManager.filterSessionFilesByYear(
            allFiles.filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.json$/)),
            year
        );

        const sessions = [];
        for (const file of sessionFiles) {
            try {
                const date = file.replace('.json', '');
                const filePath = `${dataPath}/${file}`;
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const sessionData = JSON.parse(fileContent);

                // Only include sessions that have games data
                if (sessionData.games?.rounds && sessionData.teams) {
                    sessions.push({ date, ...sessionData });
                }
            } catch (error) {
                console.error(`Error loading session file ${file}:`, error);
                // Skip this file and continue
            }
        }

        return sessions;
    }

    /**
     * Generate comprehensive year recap statistics
     * @param {number} year - Year to generate statistics for
     * @returns {Promise<Object>} - Year recap statistics
     */
    async generateYearRecap(year) {
        const rankingsManager = createRankingsManager().setLeague(this.leagueId);
        const rankingsData = await rankingsManager.loadEnhancedRankings(year);

        // Check if we have data for this year
        if (!rankingsData.calculatedDates || rankingsData.calculatedDates.length === 0) {
            throw new Error('No data available for this year');
        }

        // Load all session files for the year
        const sessions = await this.loadYearSessions(year);

        // Calculate aggregated statistics
        return await this.calculateYearStats(rankingsData, sessions);
    }

    /**
     * Calculate comprehensive year statistics
     * @param {Object} rankingsData - Current year rankings data
     * @param {Array} sessions - All session data for the year
     * @returns {Promise<Object>} - Comprehensive year statistics
     */
    async calculateYearStats(rankingsData, sessions) {
        const players = rankingsData.players;
        const sessionDates = rankingsData.calculatedDates;

        // Year Overview
        const overview = this.calculateOverview(sessionDates, sessions, players);

        // Individual Awards
        const ironManAward = await this.calculateIronManAward(players);
        const mostImproved = await this.calculateMostImproved(players);
        const kingOfKings = await this.calculateKingOfKings(players);
        const playerOfYear = await this.calculatePlayerOfYear(players);

        // Team Awards
        const teamOfYear = await this.calculateTeamOfYear(players);
        const dreamTeam = await this.calculateDreamTeam(players);
        const teamStats = await this.calculateTeamStats(sessions);

        // Fun Facts
        const funFacts = this.calculateFunFacts(sessions);

        return {
            overview,
            ironManAward,
            mostImproved,
            kingOfKings,
            playerOfYear,
            teamOfYear,
            dreamTeam,
            invincibles: teamStats.bestTeam,
            underdogs: teamStats.worstTeam,
            funFacts
        };
    }

    /**
     * Calculate year overview statistics
     * @param {Array} sessionDates - Array of session dates
     * @param {Array} sessions - All session data
     * @param {Object} players - Player data
     * @returns {Object} - Overview statistics
     */
    calculateOverview(sessionDates, sessions, players) {
        return {
            totalSessions: sessionDates.length,
            totalMatches: sessions.reduce(
                (sum, s) => sum + (s.games?.rounds?.flat().length || 0),
                0
            ),
            totalPlayers: Object.keys(players).length,
            totalGoals: sessions.reduce((sum, s) => {
                return (
                    sum +
                    (s.games?.rounds?.flat().reduce((g, match) => {
                        return g + (match.homeScore || 0) + (match.awayScore || 0);
                    }, 0) || 0)
                );
            }, 0),
            firstSession: sessionDates[0],
            lastSession: sessionDates[sessionDates.length - 1]
        };
    }

    /**
     * Calculate Iron Man Award (most appearances, tiebreaker: total games played)
     * @param {Object} players - Player data
     * @returns {Promise<Array>} - Top 3 players
     */
    async calculateIronManAward(players) {
        // Load avatar data
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        return Object.entries(players)
            .map(([name, p]) => {
                // Get actual total games played from ELO data
                const totalGames = p.elo?.gamesPlayed || 0;

                // Generate proper avatar URL if player has an avatar
                const avatarUrl = avatars[name]?.avatar
                    ? `/api/rankings/${encodeURIComponent(name)}/avatar`
                    : null;

                return {
                    name,
                    appearances: p.appearances,
                    totalGames,
                    rankingPoints: p.rankingPoints,
                    avatarUrl
                };
            })
            .sort((a, b) => {
                if (b.appearances !== a.appearances) return b.appearances - a.appearances;
                return b.totalGames - a.totalGames;
            })
            .slice(0, 3);
    }

    /**
     * Calculate Most Improved (lowest rank to current rank, full confidence players only)
     * @param {Object} players - Current year player data
     * @returns {Array} - Top 3 most improved players
     */
    async calculateMostImproved(players) {
        // Load avatar data
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        // Calculate confidence threshold (66% of max appearances)
        const CONFIDENCE_FRACTION = 0.66;
        const maxAppearances = Math.max(...Object.values(players).map((p) => p.appearances || 0));
        const confidenceThreshold = Math.max(1, Math.round(maxAppearances * CONFIDENCE_FRACTION));

        return Object.entries(players)
            .map(([name, p]) => {
                // Only include players with full confidence
                if (p.appearances < confidenceThreshold) {
                    return null;
                }

                const sessionDatesForPlayer = Object.keys(p.rankingDetail || {}).sort();

                // Need at least 2 sessions to show improvement
                if (sessionDatesForPlayer.length < 2) {
                    return null;
                }

                // Get starting rank (first session)
                const startingRank = p.rankingDetail[sessionDatesForPlayer[0]].rank;

                // Find lowest rank (worst position) across all sessions
                let lowestRank = startingRank;
                for (const date of sessionDatesForPlayer) {
                    const sessionRank = p.rankingDetail[date].rank;
                    if (sessionRank > lowestRank) {
                        lowestRank = sessionRank;
                    }
                }

                // Current rank is the final rank
                const currentRank = p.rank;

                // Calculate improvement: lowest rank - current rank
                const rankImprovement = lowestRank - currentRank;

                // Generate proper avatar URL if player has an avatar
                const playerAvatar = avatars[name];
                const avatarUrl =
                    playerAvatar && playerAvatar.avatar
                        ? `/api/rankings/${encodeURIComponent(name)}/avatar`
                        : null;

                return {
                    name,
                    startingRank,
                    lowestRank,
                    currentRank,
                    rankImprovement,
                    rankingPoints: p.rankingPoints,
                    avatarUrl
                };
            })
            .filter((p) => p !== null && p.rankImprovement > 0)
            .sort((a, b) => b.rankImprovement - a.rankImprovement)
            .slice(0, 3);
    }

    /**
     * Calculate King of Kings (most trophies)
     * @param {Object} players - Player data
     * @returns {Array} - Top 3 trophy winners
     */
    async calculateKingOfKings(players) {
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        return Object.entries(players)
            .map(([name, p]) => {
                const avatarUrl = avatars[name]?.avatar
                    ? `/api/rankings/${encodeURIComponent(name)}/avatar`
                    : null;

                return {
                    name,
                    leagueWins: p.leagueWins || 0,
                    cupWins: p.cupWins || 0,
                    totalTrophies: (p.leagueWins || 0) + (p.cupWins || 0),
                    rankingPoints: p.rankingPoints,
                    avatarUrl
                };
            })
            .filter((p) => p.totalTrophies > 0)
            .sort((a, b) => b.totalTrophies - a.totalTrophies)
            .slice(0, 3);
    }

    /**
     * Calculate Player of the Year (top ranking points)
     * @param {Object} players - Player data
     * @returns {Promise<Array>} - Top 3 players by ranking points
     */
    async calculatePlayerOfYear(players) {
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        return Object.entries(players)
            .map(([name, p]) => {
                const avatarUrl = avatars[name]?.avatar
                    ? `/api/rankings/${encodeURIComponent(name)}/avatar`
                    : null;

                return {
                    name,
                    rankingPoints: p.rankingPoints,
                    rank: p.rank,
                    appearances: p.appearances,
                    ptsPerAppearance: p.weightedAverage || 0,
                    avatarUrl
                };
            })
            .sort((a, b) => b.rankingPoints - a.rankingPoints)
            .slice(0, 3);
    }

    /**
     * Calculate Team of the Year (top 6 by ranking points)
     * @param {Object} players - Player data
     * @returns {Promise<Array>} - Top 6 players
     */
    async calculateTeamOfYear(players) {
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        return Object.entries(players)
            .map(([name, p]) => {
                const avatarUrl = avatars[name]?.avatar
                    ? `/api/rankings/${encodeURIComponent(name)}/avatar`
                    : null;

                return {
                    name,
                    rankingPoints: p.rankingPoints,
                    rank: p.rank,
                    avatarUrl
                };
            })
            .sort((a, b) => b.rankingPoints - a.rankingPoints)
            .slice(0, 6);
    }

    /**
     * Calculate Dream Team (top 6 by ELO rating)
     * @param {Object} players - Player data
     * @returns {Promise<Array>} - Top 6 players by ELO
     */
    async calculateDreamTeam(players) {
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();

        return (
            Object.entries(players)
                // eslint-disable-next-line no-unused-vars
                .filter(([_, p]) => p.elo && p.elo.rating)
                .map(([name, p]) => {
                    const avatarUrl = avatars[name]?.avatar
                        ? `/api/rankings/${encodeURIComponent(name)}/avatar`
                        : null;

                    return {
                        name,
                        eloRating: p.elo.rating,
                        gamesPlayed: p.elo.gamesPlayed || 0,
                        avatarUrl
                    };
                })
                .sort((a, b) => b.eloRating - a.eloRating)
                .slice(0, 6)
        );
    }

    /**
     * Calculate team statistics - finds best/worst single team across all sessions
     * Includes both league games and knockout cup games
     * @param {Array} sessions - All session data
     * @returns {Promise<Object>} - Team statistics including best and worst teams
     */
    async calculateTeamStats(sessions) {
        const avatarManager = createAvatarManager().setLeague(this.leagueId);
        const avatars = await avatarManager.loadAvatars();
        const allTeams = [];

        // Evaluate each team in each session independently
        for (const session of sessions) {
            const { date, teams, games } = session;
            if (!teams || !games?.rounds) continue;

            const teamNames = Object.keys(teams);
            const leagueMatches = [];
            const cupMatches = [];

            // Extract league match results for this session
            for (const round of games.rounds) {
                for (const game of round) {
                    if (game.homeScore !== null && game.awayScore !== null) {
                        leagueMatches.push({
                            home: game.home,
                            away: game.away,
                            homeScore: game.homeScore,
                            awayScore: game.awayScore
                        });
                    }
                }
            }

            // Extract knockout cup match results if available
            const knockoutGames = games['knockout-games'] || games.knockout;
            if (knockoutGames && knockoutGames.bracket) {
                for (const game of knockoutGames.bracket) {
                    if (game.homeScore !== null && game.awayScore !== null) {
                        cupMatches.push({
                            home: game.home,
                            away: game.away,
                            homeScore: game.homeScore,
                            awayScore: game.awayScore
                        });
                    }
                }
            }

            // Helper function to calculate stats for a set of matches
            const calculateMatchStats = (matches, teamName) => {
                let wins = 0;
                let draws = 0;
                let losses = 0;
                let goalsFor = 0;
                let goalsAgainst = 0;

                for (const match of matches) {
                    if (match.home === teamName) {
                        goalsFor += match.homeScore;
                        goalsAgainst += match.awayScore;
                        if (match.homeScore > match.awayScore) wins++;
                        else if (match.homeScore < match.awayScore) losses++;
                        else draws++;
                    } else if (match.away === teamName) {
                        goalsFor += match.awayScore;
                        goalsAgainst += match.homeScore;
                        if (match.awayScore > match.homeScore) wins++;
                        else if (match.awayScore < match.homeScore) losses++;
                        else draws++;
                    }
                }

                return { wins, draws, losses, goalsFor, goalsAgainst };
            };

            // Calculate stats for each team in this session
            for (const teamName of teamNames) {
                // Calculate league stats
                const leagueStats = calculateMatchStats(leagueMatches, teamName);
                // Calculate cup stats
                const cupStats = calculateMatchStats(cupMatches, teamName);

                // Combined totals
                const wins = leagueStats.wins + cupStats.wins;
                const draws = leagueStats.draws + cupStats.draws;
                const losses = leagueStats.losses + cupStats.losses;
                const goalsFor = leagueStats.goalsFor + cupStats.goalsFor;
                const goalsAgainst = leagueStats.goalsAgainst + cupStats.goalsAgainst;
                const totalGames = wins + draws + losses;

                // Calculate points (3 for win, 1 for draw)
                const points = wins * 3 + draws;
                // Total available points if they won all games
                const totalAvailablePoints = totalGames * 3;
                // Points percentage
                const pointsPercentage =
                    totalAvailablePoints > 0 ? (points / totalAvailablePoints) * 100 : 0;
                const goalDifference = goalsFor - goalsAgainst;

                // Each team is unique per session
                allTeams.push({
                    sessionDate: date,
                    teamName,
                    wins,
                    draws,
                    losses,
                    goalsFor,
                    goalsAgainst,
                    goalDifference,
                    totalGames,
                    points,
                    totalAvailablePoints,
                    pointsPercentage,
                    players: teams[teamName] || [],
                    leagueStats,
                    cupStats
                });
            }
        }

        // Find top 3 best teams (Invincibles)
        // Sort by: points percentage DESC, goal difference DESC, goals scored DESC, total points DESC
        const bestTeams = [...allTeams]
            .sort((a, b) => {
                if (Math.abs(b.pointsPercentage - a.pointsPercentage) > 0.01)
                    return b.pointsPercentage - a.pointsPercentage;
                if (b.goalDifference !== a.goalDifference)
                    return b.goalDifference - a.goalDifference;
                if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
                return b.points - a.points;
            })
            .slice(0, 3);

        // Find top 3 worst teams (Underdogs)
        // Sort by: points percentage ASC, goal difference ASC, goals scored ASC, total points ASC
        const worstTeams = [...allTeams]
            .sort((a, b) => {
                if (Math.abs(a.pointsPercentage - b.pointsPercentage) > 0.01)
                    return a.pointsPercentage - b.pointsPercentage;
                if (a.goalDifference !== b.goalDifference)
                    return a.goalDifference - b.goalDifference;
                if (a.goalsFor !== b.goalsFor) return a.goalsFor - b.goalsFor;
                return a.points - b.points;
            })
            .slice(0, 3);

        // Helper to add avatars to players
        const addAvatarsToPlayers = (playerNames) => {
            return playerNames.map((name) => ({
                name,
                avatarUrl: avatars[name]?.avatar
                    ? `/api/rankings/${encodeURIComponent(name)}/avatar`
                    : null
            }));
        };

        return {
            bestTeam:
                bestTeams.length > 0
                    ? {
                          sessionDate: bestTeams[0].sessionDate,
                          teamName: bestTeams[0].teamName,
                          wins: bestTeams[0].wins,
                          draws: bestTeams[0].draws,
                          losses: bestTeams[0].losses,
                          goalsFor: bestTeams[0].goalsFor,
                          goalsAgainst: bestTeams[0].goalsAgainst,
                          goalDifference: bestTeams[0].goalDifference,
                          totalGames: bestTeams[0].totalGames,
                          points: bestTeams[0].points,
                          totalAvailablePoints: bestTeams[0].totalAvailablePoints,
                          pointsPercentage: bestTeams[0].pointsPercentage,
                          players: addAvatarsToPlayers(bestTeams[0].players),
                          leagueRecord: bestTeams[0].leagueStats,
                          cupRecord: bestTeams[0].cupStats,
                          honorableMentions: bestTeams.slice(1).map((t) => ({
                              sessionDate: t.sessionDate,
                              teamName: t.teamName,
                              pointsPercentage: t.pointsPercentage
                          }))
                      }
                    : null,
            worstTeam:
                worstTeams.length > 0
                    ? {
                          sessionDate: worstTeams[0].sessionDate,
                          teamName: worstTeams[0].teamName,
                          wins: worstTeams[0].wins,
                          draws: worstTeams[0].draws,
                          losses: worstTeams[0].losses,
                          goalsFor: worstTeams[0].goalsFor,
                          goalsAgainst: worstTeams[0].goalsAgainst,
                          goalDifference: worstTeams[0].goalDifference,
                          totalGames: worstTeams[0].totalGames,
                          points: worstTeams[0].points,
                          totalAvailablePoints: worstTeams[0].totalAvailablePoints,
                          pointsPercentage: worstTeams[0].pointsPercentage,
                          players: addAvatarsToPlayers(worstTeams[0].players),
                          leagueRecord: worstTeams[0].leagueStats,
                          cupRecord: worstTeams[0].cupStats,
                          honorableMentions: worstTeams.slice(1).map((t) => ({
                              sessionDate: t.sessionDate,
                              teamName: t.teamName,
                              pointsPercentage: t.pointsPercentage
                          }))
                      }
                    : null
        };
    }

    /**
     * Calculate fun facts from session data
     * @param {Array} sessions - All session data
     * @returns {Object} - Fun facts
     */
    calculateFunFacts(sessions) {
        let highestScoringMatch = null;
        let biggestMarginWin = null;
        let mostGoalsSession = { date: null, goals: 0 };
        let fewestGoalsSession = { date: null, goals: Infinity };

        for (const session of sessions) {
            const { date, games } = session;
            if (!games?.rounds) continue;

            let sessionGoals = 0;
            let hasCompletedGames = false;

            for (const round of games.rounds) {
                for (const match of round) {
                    if (match.homeScore !== null && match.awayScore !== null) {
                        hasCompletedGames = true;
                        const totalGoals = match.homeScore + match.awayScore;
                        const margin = Math.abs(match.homeScore - match.awayScore);

                        sessionGoals += totalGoals;

                        // Highest scoring match
                        if (!highestScoringMatch || totalGoals > highestScoringMatch.totalGoals) {
                            highestScoringMatch = {
                                date,
                                home: match.home,
                                away: match.away,
                                homeScore: match.homeScore,
                                awayScore: match.awayScore,
                                totalGoals
                            };
                        }

                        // Biggest margin win
                        if (!biggestMarginWin || margin > biggestMarginWin.margin) {
                            biggestMarginWin = {
                                date,
                                home: match.home,
                                away: match.away,
                                homeScore: match.homeScore,
                                awayScore: match.awayScore,
                                margin
                            };
                        }
                    }
                }
            }

            // Only count sessions with completed games for most/fewest goals
            if (hasCompletedGames) {
                if (sessionGoals > mostGoalsSession.goals) {
                    mostGoalsSession = { date, goals: sessionGoals };
                }
                if (sessionGoals < fewestGoalsSession.goals) {
                    fewestGoalsSession = { date, goals: sessionGoals };
                }
            }
        }

        return {
            highestScoringMatch,
            biggestMarginWin,
            mostGoalsSession,
            fewestGoalsSession: fewestGoalsSession.goals !== Infinity ? fewestGoalsSession : null
        };
    }
}

/**
 * Factory function to create a new YearRecapManager instance
 * @returns {YearRecapManager}
 */
export const createYearRecapManager = () => new YearRecapManager();
