import { json, error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await createRankingsManager().setLeague(leagueId).loadEnhancedRankings();
    return json(rankingsData);
};

export const POST = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await createRankingsManager().setLeague(leagueId).updateRankings();
    return json(rankingsData);
};
