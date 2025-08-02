import { error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals }) {
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

        // Sort ranking details by date (newest first)
        const sortedDetails = Object.entries(playerData.rankingDetail || {})
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, detail]) => ({ date, ...detail }));

        return {
            player,
            playerData: {
                ...playerData,
                sortedDetails
            },
            rankingMetadata: rankings.rankingMetadata
        };
    } catch (err) {
        if (err.status) {
            throw err;
        }

        console.error('Error loading player rankings:', err);
        throw error(500, 'Failed to load player ranking details');
    }
}
