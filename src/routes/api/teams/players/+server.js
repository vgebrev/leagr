import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const DELETE = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }
    const date = url.searchParams.get('date');
    const body = await request.json();

    if (!date) {
        return error(400, 'Date parameter is required');
    }

    if (!body || !body.playerName || !body.teamName) {
        return error(400, 'Invalid request body. playerName and teamName are required');
    }

    // Default action is to move to waiting list, but can be 'remove' for complete removal
    const action = body.action || 'waitingList';

    try {
        const result = await createPlayerManager()
            .setDate(date)
            .setLeague(leagueId)
            .removePlayerFromTeam(body.playerName, body.teamName, action);
        return json(result);
    } catch (err) {
        console.error('Error removing player from team:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to remove player from team');
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

    if (!body || !body.playerName || !body.teamName) {
        return error(400, 'Invalid request body. playerName and teamName are required');
    }

    try {
        // Try to assign player to team (works for both available and waiting list players)
        const result = await createPlayerManager()
            .setDate(date)
            .setLeague(leagueId)
            .fillEmptySlotWithPlayer(body.teamName, body.playerName);
        return json(result);
    } catch (err) {
        console.error('Error assigning player to team:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to assign player to team');
    }
};

export const PATCH = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const date = url.searchParams.get('date');
    const body = await request.json();

    if (!date) {
        return error(400, 'Date parameter is required');
    }

    const { operation } = body;

    try {
        if (operation === 'fillSlot') {
            // Fill empty slot with specific player
            if (!body.playerName || !body.teamName) {
                return error(400, 'playerName and teamName are required for fillSlot operation');
            }

            const result = await createPlayerManager()
                .setDate(date)
                .setLeague(leagueId)
                .fillEmptySlotWithPlayer(body.teamName, body.playerName);
            return json(result);
        } else {
            return error(400, 'Invalid operation. Supported operations: fillSlot');
        }
    } catch (err) {
        console.error('Error performing team operation:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to perform team operation');
    }
};

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
        const availableSlots = await createPlayerManager()
            .setDate(date)
            .setLeague(leagueId)
            .getAvailableSlots();
        return json({ availableSlots });
    } catch (err) {
        console.error('Error getting available slots:', err);
        return error(500, 'Failed to get available slots');
    }
};
