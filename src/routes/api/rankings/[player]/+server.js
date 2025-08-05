import { json, error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

/**
 * Extract rank progression from complete ranking history
 * @param {Object} playerData - Player data with complete rankingDetail
 * @returns {Array} Array of rank progression points
 */
function extractRankProgression(playerData) {
    const progression = [];

    // Get all dates and sort chronologically (oldest first)
    const dates = Object.keys(playerData.rankingDetail).sort();

    let cumulativePoints = 0;
    let appearances = 0;

    for (const date of dates) {
        const entry = playerData.rankingDetail[date];

        // Update cumulative totals if this was an appearance
        if (entry.totalPoints !== null) {
            cumulativePoints += entry.totalPoints;
            appearances += 1;
        }

        // Add progression point
        progression.push({
            date: date,
            rank: entry.rank,
            totalPlayers: entry.totalPlayers,
            points: cumulativePoints,
            appearances: appearances,
            played: entry.team !== null // Visual indicator for chart
        });
    }

    return progression;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    const rankingsManager = createRankingsManager().setLeague(leagueId);

    try {
        // Load enhanced rankings data
        const rankings = await rankingsManager.loadEnhancedRankings();

        // Find the specific player
        const playerData = rankings.players[player];

        if (!playerData) {
            throw error(404, `Player "${player}" not found in rankings`);
        }

        // Sort ranking details by date (newest first) - ONLY include actual appearances
        const sortedDetails = Object.entries(playerData.rankingDetail || {})
            .filter(([, detail]) => detail.team !== null) // Only appearances
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, detail]) => ({ date, ...detail }));

        // Extract rank progression from complete history
        const rankProgression = extractRankProgression(playerData);

        return json({
            player,
            playerData: {
                ...playerData,
                sortedDetails,
                rankProgression
            },
            rankingMetadata: rankings.rankingMetadata
        });
    } catch (err) {
        if (err.status) {
            throw err;
        }

        console.error('Error loading player rankings:', err);
        throw error(500, 'Failed to load player ranking details');
    }
}
