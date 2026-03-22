import { json, error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { createAvatarManager } from '$lib/server/avatarManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

/**
 * Create unified details array with all necessary data for frontend
 * @param {Object} playerData - Player data with complete history
 * @param {number|null} limit - Optional limit for number of recent appearances
 * @returns {Array} Array of unified detail objects
 */
function createUnifiedDetails(playerData, limit = null) {
    // Get all dates and sort chronologically (oldest first)
    const allDates = Object.keys(playerData.history).sort();

    let cumulativePoints = 0;
    const allDetails = [];

    for (const date of allDates) {
        const entry = playerData.history[date];
        const attended = 'points' in entry;

        // Update cumulative totals if this was an appearance
        if (attended) {
            cumulativePoints += entry.points.total;
        }

        // Create unified detail object with all necessary data
        allDetails.push({
            date: date,
            // Ranking data (for chart)
            rank: entry.ranking.rank,
            totalPlayers: entry.ranking.totalPlayers,
            rankingPoints: entry.ranking.rankingPoints || cumulativePoints,
            played: attended,
            // Appearance data (for cards) - only if played
            ...(attended
                ? {
                      team: entry.team,
                      appearancePoints: entry.points.appearance || 0,
                      matchPoints: entry.points.match || 0,
                      bonusPoints: entry.points.bonus || 0,
                      knockoutPoints: entry.points.knockout || 0,
                      totalPoints: entry.points.total || 0,
                      leagueWinner: entry.performance.leagueWinner || false,
                      cupWinner: entry.performance.cupWinner || false,
                      eloRating: entry.ratings.elo || 1000,
                      leaguePosition: entry.performance.leaguePosition ?? null,
                      cupProgress: entry.performance.cupProgress
                  }
                : {})
        });
    }

    // Apply limit to appearances only (not all sessions)
    if (limit !== null && limit !== undefined) {
        // limit=0 means no session data at all
        if (limit === 0) {
            return [];
        }

        // limit>0 means last N appearances
        const recentAppearances = allDetails.filter((d) => d.played).slice(-limit);

        // Include recent appearances and any non-played sessions in that date range
        const minDate = recentAppearances.length > 0 ? recentAppearances[0].date : null;
        return allDetails.filter((d) => !minDate || d.date >= minDate);
    }

    return allDetails;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals, url }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    // Parse limit parameter
    const limitParam = url.searchParams.get('limit');
    const limit =
        limitParam && limitParam !== 'null' && limitParam !== 'undefined'
            ? parseInt(limitParam, 10)
            : null;

    const dateParam = url.searchParams.get('date');
    const selectedDate = dateParam && dateParam.trim().length > 0 ? dateParam.trim() : null;

    // Parse year parameter, default to current year
    const year = url.searchParams.get('year')
        ? parseInt(url.searchParams.get('year'), 10)
        : new Date().getFullYear();

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    const rankingsManager = createRankingsManager().setLeague(leagueId);
    const avatarManager = createAvatarManager().setLeague(leagueId);

    try {
        // Load enhanced rankings data and avatar data
        const rankings = await rankingsManager.loadEnhancedRankings(year);
        const avatarsData = await avatarManager.loadAvatars();

        // Find the specific player
        const playerData = rankings.players[player];

        if (!playerData) {
            return error(404, `Player "${player}" not found in ${year} rankings`);
        }

        // Create unified details array (include rating stats where present)
        const details = createUnifiedDetails(playerData, limit).map((d) => {
            const entry = playerData.history?.[d.date];
            if (!entry) return d;
            const r = entry.ratings;
            return {
                ...d,
                goalsForPerSession: r.teamGF?.perSession ?? null,
                goalsAgainstPerSession: r.teamGA?.perSession ?? null,
                attackingRating: r.attacking ?? null,
                controlRating: r.control ?? null,
                teamGFNorm: r.teamGF?.norm ?? null,
                teamGANorm: r.teamGA?.norm ?? null,
                goalsNorm: r.goals?.norm ?? null,
                offActionsNorm: r.offActions?.norm ?? null,
                defActionsNorm: r.defActions?.norm ?? null,
                saveActionsNorm: r.saveActions?.norm ?? null,
                eloGames: r.eloGames ?? null
            };
        });

        // Determine which date to use for the snapshot: requested date or latest
        let snapshotDate = selectedDate;
        if (!snapshotDate) {
            const allDates = Object.keys(playerData.history || {}).sort();
            snapshotDate = allDates[allDates.length - 1];
        }

        let detailForDate = null;
        if (snapshotDate && playerData.history?.[snapshotDate]) {
            const entry = playerData.history[snapshotDate];
            const r = entry.ratings;
            detailForDate = {
                date: snapshotDate,
                rank: entry.ranking.rank ?? null,
                totalPlayers: entry.ranking.totalPlayers ?? null,
                rankingPoints: entry.ranking.rankingPoints ?? null,
                points: entry.points?.total ?? null,
                goalsForPerSession: r.teamGF?.perSession ?? null,
                goalsAgainstPerSession: r.teamGA?.perSession ?? null,
                attackingRating: r.attacking ?? null,
                controlRating: r.control ?? null,
                teamGFNorm: r.teamGF?.norm ?? null,
                teamGANorm: r.teamGA?.norm ?? null,
                goalsNorm: r.goals?.norm ?? null,
                offActionsNorm: r.offActions?.norm ?? null,
                defActionsNorm: r.defActions?.norm ?? null,
                saveActionsNorm: r.saveActions?.norm ?? null,
                eloGames: r.eloGames ?? null, // { allTime, season } object
                elo: r.elo ? { rating: r.elo } : null
            };
        }

        // Remove history from response to reduce payload size
        // eslint-disable-next-line no-unused-vars
        const { history: _, ...cleanPlayerData } = playerData;

        // Get avatar data from avatars.json
        const playerAvatar = avatarsData[player] || {};

        return json({
            player,
            playerData: {
                ...cleanPlayerData,
                avatar: playerAvatar.avatar || null,
                pendingAvatar: playerAvatar.pendingAvatar || null,
                details: details, // Single source of truth - client handles sorting/filtering
                detailForDate
            },
            rankingMetadata: rankings.rankingMetadata,
            limit: limit
        });
    } catch (err) {
        if (err.status) {
            throw err;
        }

        console.error('Error loading player rankings:', err);
        throw error(500, 'Failed to load player ranking details');
    }
}
