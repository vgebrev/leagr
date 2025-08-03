import { json, error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await createRankingsManager().setLeague(leagueId).loadEnhancedRankings();

    // Strip rankingDetail data for API endpoint (only needed for individual player pages)
    const strippedRankings = {
        ...rankingsData,
        players: Object.fromEntries(
            Object.entries(rankingsData.players).map(([name, playerData]) => [
                name,
                {
                    ...playerData,
                    rankingDetail: undefined
                }
            ])
        )
    };

    return json(strippedRankings);
};

export const POST = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await createRankingsManager().setLeague(leagueId).updateRankings();

    // Strip rankingDetail data for API endpoint (only needed for individual player pages)
    const strippedRankings = {
        ...rankingsData,
        players: Object.fromEntries(
            Object.entries(rankingsData.players).map(([name, playerData]) => [
                name,
                {
                    ...playerData,
                    rankingDetail: undefined
                }
            ])
        )
    };

    return json(strippedRankings);
};
