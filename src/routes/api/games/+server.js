import { error, json } from '@sveltejs/kit';
import { data } from '$lib/server/data.js';

export const GET = async ({ url }) => {
	const date = url.searchParams.get('date');
	const teams = (await data.get('games', date)) || {};
	return json(teams);
};

export const POST = async ({ request, url }) => {
	const date = url.searchParams.get('date');
	const body = await request.json();
	if (!body) {
		return error(400, 'Invalid request body');
	}
	const result = await data.set('games', date, body, {});
	return result ? json({ success: result }) : error(500, 'Failed to set games');
};
