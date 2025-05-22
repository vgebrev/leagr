import { error, json } from '@sveltejs/kit';
import { data } from '$lib/server/data.js';

export const GET = async ({ url }) => {
	const date = url.searchParams.get('date');
	const players = (await data.get('playerLimit', date)) || 18;
	return json(players);
};

export const POST = async ({ request, url }) => {
	const date = url.searchParams.get('date');
	const body = await request.json();
	if (!body || !body.playerLimit) {
		return error(400, 'Invalid request body');
	}
	const result = await data.set('playerLimit', date, body.playerLimit, 18);
	return result ? json({ success: result }) : error(500, 'Failed to add player');
};
