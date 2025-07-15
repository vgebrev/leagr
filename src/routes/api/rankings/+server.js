import { json, error } from '@sveltejs/kit';
import { rankings } from '$lib/server/rankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await rankings.loadEnhancedRankings(leagueId);
    return json(rankingsData);
};

export const POST = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await rankings.updateRankings(leagueId);
    return json(rankingsData);
};
