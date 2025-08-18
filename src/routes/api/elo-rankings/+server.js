import { json, error } from '@sveltejs/kit';
import { createEloRankingsManager } from '$lib/server/eloRankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const eloRankingsData = await createEloRankingsManager()
        .setLeague(leagueId)
        .getEnhancedEloRankings();

    return json(eloRankingsData);
};

export const POST = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    await createEloRankingsManager().setLeague(leagueId).updateAllEloRankings();

    // Return enhanced data for consistency with GET
    const enhancedData = await createEloRankingsManager()
        .setLeague(leagueId)
        .getEnhancedEloRankings();

    return json(enhancedData);
};
