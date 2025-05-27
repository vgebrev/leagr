import { error, json } from '@sveltejs/kit';
import { data } from '$lib/server/data.js';

export const GET = async ({ url }) => {
  const date = url.searchParams.get('date');
  const players = (await data.get('players', date)) || [];
  return json(players);
};

export const POST = async ({ request, url }) => {
  const date = url.searchParams.get('date');
  const body = await request.json();
  if (!body || !body.playerName) {
    return error(400, 'Invalid request body');
  }
  const result = await data.set('players', date, body.playerName);
  return result ? json({ success: result }) : error(500, 'Failed to add player');
};

export const DELETE = async ({ request, url }) => {
  const date = url.searchParams.get('date');
  const body = await request.json();
  if (!body || !body.playerName) {
    return error(400, 'Invalid request body');
  }
  const result = await data.remove('players', date, body.playerName);
  return result ? json({ success: result }) : error(500, 'Failed to remove player');
};
