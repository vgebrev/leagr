import { rankings } from '$lib/server/rankings.js';
import { json } from '@sveltejs/kit';

export async function GET() {
    const rankingData = await rankings.loadRankings();
    const sorted = Object.keys(rankingData.players ?? {}).sort((a, b) =>
        a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())
    );
    return json(sorted);
}
