import { json, error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { createAvatarManager } from '$lib/server/avatarManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

/**
 * Create unified details array with all necessary data for frontend
 * @param {Object} playerData - Player data with complete rankingDetail
 * @param {number|null} limit - Optional limit for number of recent appearances
 * @returns {Array} Array of unified detail objects
 */
function createUnifiedDetails(playerData, limit = null) {
    // Get all dates and sort chronologically (oldest first)
    const allDates = Object.keys(playerData.rankingDetail).sort();

    let cumulativePoints = 0;
    const allDetails = [];

    for (const date of allDates) {
        const entry = playerData.rankingDetail[date];

        // Update cumulative totals if this was an appearance
        if (entry.totalPoints !== null) {
            cumulativePoints += entry.totalPoints;
        }

        // Create unified detail object with all necessary data
        allDetails.push({
            date: date,
            // Ranking data (for chart)
            rank: entry.rank,
            totalPlayers: entry.totalPlayers,
            rankingPoints: entry.rankingPoints || cumulativePoints,
            played: entry.team !== null,
            // Appearance data (for cards) - only if played
            ...(entry.team !== null
                ? {
                      team: entry.team,
                      appearancePoints: entry.appearancePoints || 0,
                      matchPoints: entry.matchPoints || 0,
                      bonusPoints: entry.bonusPoints || 0,
                      knockoutPoints: entry.knockoutPoints || 0,
                      totalPoints: entry.totalPoints || 0,
                      leagueWinner: entry.leagueWinner || false,
                      cupWinner: entry.cupWinner || false,
                      eloRating: entry.eloRating || 1000,
                      leaguePosition:
                          entry.leaguePosition !== undefined ? entry.leaguePosition : null,
                      cupProgress: entry.cupProgress !== undefined ? entry.cupProgress : undefined
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
            return error(404, `Player "${player}" not found in rankings`);
        }

        // Create unified details array
        const details = createUnifiedDetails(playerData, limit);

        // Remove rankingDetail from response to reduce payload size
        // eslint-disable-next-line no-unused-vars
        const { rankingDetail: _, ...cleanPlayerData } = playerData;

        // Get avatar data from avatars.json
        const playerAvatar = avatarsData[player] || {};

        return json({
            player,
            playerData: {
                ...cleanPlayerData,
                avatar: playerAvatar.avatar || null,
                pendingAvatar: playerAvatar.pendingAvatar || null,
                details: details // Single source of truth - client handles sorting/filtering
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
