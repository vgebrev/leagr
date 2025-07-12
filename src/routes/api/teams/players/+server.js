import { error, json } from '@sveltejs/kit';
import { playerManager } from '$lib/server/playerManager.js';

export const DELETE = async ({ request, url }) => {
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
        const result = await playerManager
            .setDate(date)
            .removePlayerFromTeam(body.playerName, body.teamName, action);
        return json(result);
    } catch (err) {
        console.error('Error removing player from team:', err);
        return error(400, err.message);
    }
};

export const POST = async ({ request, url }) => {
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
        const result = await playerManager
            .setDate(date)
            .fillEmptySlotWithPlayer(body.teamName, body.playerName);
        return json(result);
    } catch (err) {
        console.error('Error assigning player to team:', err);
        return error(400, err.message);
    }
};

export const PATCH = async ({ request, url }) => {
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

            const result = await playerManager
                .setDate(date)
                .fillEmptySlotWithPlayer(body.teamName, body.playerName);
            return json(result);
        } else if (operation === 'movePlayerBetweenTeams') {
            // Move player between teams
            if (!body.playerName || !body.fromTeam || !body.toTeam) {
                return error(
                    400,
                    'playerName, fromTeam, and toTeam are required for movePlayerBetweenTeams operation'
                );
            }

            const result = await playerManager
                .setDate(date)
                .movePlayerBetweenTeams(body.playerName, body.fromTeam, body.toTeam);
            return json({ teams: result });
        } else {
            return error(
                400,
                'Invalid operation. Supported operations: fillSlot, movePlayerBetweenTeams'
            );
        }
    } catch (err) {
        console.error('Error performing team operation:', err);
        return error(400, err.message);
    }
};

export const GET = async ({ url }) => {
    const date = url.searchParams.get('date');

    if (!date) {
        return error(400, 'Date parameter is required');
    }

    try {
        const availableSlots = await playerManager.setDate(date).getAvailableSlots();
        return json({ availableSlots });
    } catch (err) {
        console.error('Error getting available slots:', err);
        return error(500, 'Failed to get available slots');
    }
};
