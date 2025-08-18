import { json, error } from '@sveltejs/kit';
import { createEloRankingsManager } from '$lib/server/eloRankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ locals, url }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    // Get date from query params, default to today
    const forDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
        return error(400, 'Invalid date format. Use YYYY-MM-DD');
    }

    const seedingScores = await createEloRankingsManager()
        .setLeague(leagueId)
        .getAllSeedingScores(forDate);

    return json({
        date: forDate,
        seedingScores
    });
};
