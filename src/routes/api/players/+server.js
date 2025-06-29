import { error, json } from '@sveltejs/kit';
import { data } from '$lib/server/data.js';

const defaultPlayers = { available: [], waitingList: [] };
export const GET = async ({ url }) => {
    const date = url.searchParams.get('date');
    const players = (await data.get('players', date)) || defaultPlayers;
    return json(players);
};

export const POST = async ({ request, url }) => {
    const date = url.searchParams.get('date');
    const body = await request.json();
    if (!body || !body.playerName || !body.list) {
        return error(400, 'Invalid request body');
    }
    const result = await data.set(
        `players.${body.list}`,
        date,
        body.playerName,
        defaultPlayers[body.list] || []
    );
    return result ? json(result) : error(500, 'Failed to add player');
};

export const DELETE = async ({ request, url }) => {
    const date = url.searchParams.get('date');
    const body = await request.json();
    if (!body || !body.playerName || !body.list) {
        return error(400, 'Invalid request body');
    }
    const result = await data.remove(`players.${body.list}`, date, body.playerName);
    return result ? json(result) : error(500, 'Failed to remove player');
};
