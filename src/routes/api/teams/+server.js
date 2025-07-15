import { error, json } from '@sveltejs/kit';
import { createPlayerManager } from '$lib/server/playerManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const date = url.searchParams.get('date');
    if (!date) {
        return error(400, 'Date parameter is required');
    }

    try {
        const gameData = await createPlayerManager().setDate(date).setLeague(leagueId).getData();
        return json(gameData.teams);
    } catch (err) {
        console.error('Error fetching teams:', err);
        return error(500, 'Failed to fetch teams');
    }
};

export const POST = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const date = url.searchParams.get('date');
    const body = await request.json();

    if (!date) {
        return error(400, 'Date parameter is required');
    }

    if (!body) {
        return error(400, 'Invalid request body');
    }

    try {
        // When teams are set, validate and cleanup player consistency

        // Set the teams using the data service (maintain existing functionality)
        const { data } = await import('$lib/server/data.js');
        await data.set('teams', date, body, {}, true, leagueId);

        // Then validate and cleanup any inconsistencies
        const result = await createPlayerManager().setDate(date).setLeague(leagueId).validateAndCleanup();

        return json(result.teams);
    } catch (err) {
        console.error('Error setting teams:', err);
        return error(500, 'Failed to set teams');
    }
};
