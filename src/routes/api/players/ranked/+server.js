import { createRankingsManager } from '$lib/server/rankings.js';
import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';

export async function GET({ locals }) {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingData = await createRankingsManager().setLeague(leagueId).loadRankings();
    const sorted = Object.keys(rankingData.players ?? {}).sort((a, b) =>
        a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())
    );
    return json(sorted);
}
