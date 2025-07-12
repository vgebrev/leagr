import { error, json } from '@sveltejs/kit';
import { playerManager } from '$lib/server/playerManager.js';

export const GET = async ({ url }) => {
    const date = url.searchParams.get('date');
    if (!date) {
        return error(400, 'Date parameter is required');
    }

    try {
        const gameData = await playerManager.setDate(date).getData();
        return json(gameData.teams);
    } catch (err) {
        console.error('Error fetching teams:', err);
        return error(500, 'Failed to fetch teams');
    }
};

export const POST = async ({ request, url }) => {
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
        await data.set('teams', date, body, {}, true);

        // Then validate and cleanup any inconsistencies
        const result = await playerManager.setDate(date).validateAndCleanup();

        return json(result.teams);
    } catch (err) {
        console.error('Error setting teams:', err);
        return error(500, 'Failed to set teams');
    }
};
