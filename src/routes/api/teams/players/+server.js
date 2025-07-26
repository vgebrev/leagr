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

    if (!body || !body.playerName) {
        return error(400, 'Invalid request body. playerName is required');
    }

    // Default action is to move to waiting list, but can be 'remove' for complete removal
    const action = body.action || 'waitingList';

    try {
        const playerManager = createPlayerManager()
            .setDate(date)
            .setLeague(leagueId);

        let result;
        if (body.teamName) {
            // Player is in a team - use removePlayerFromTeam
            result = await playerManager.removePlayerFromTeam(body.playerName, body.teamName, action);
        } else {
            // Player is unassigned/waiting - use simple removePlayer for complete removal
            result = await playerManager.removePlayer(body.playerName);
        }
        
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
