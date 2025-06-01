import { json } from '@sveltejs/kit';
import { rankings } from '$lib/server/rankings.js';

export const GET = async () => {
    const rankingsData = await rankings.loadRankings();
    return json(rankingsData);
};

export const POST = async () => {
    const rankingsData = await rankings.updateRankings();
    return json(rankingsData);
};
