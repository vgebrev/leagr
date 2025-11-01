import { createRankingsManager } from '$lib/server/rankings.js';
import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { MIN_YEAR, MAX_YEAR } from '$lib/shared/yearConfig.js';
import { SvelteSet } from 'svelte/reactivity';

export async function GET({ locals }) {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsManager = createRankingsManager().setLeague(leagueId);

    // Collect unique player names from all years (Set automatically deduplicates)
    const allPlayers = new SvelteSet();

    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
        try {
            const rankingData = await rankingsManager.loadRankings(year);
            Object.keys(rankingData.players ?? {}).forEach((player) => allPlayers.add(player));
        } catch {
            // Year file doesn't exist, skip it
        }
    }

    // Sort alphabetically (case-insensitive)
    const sorted = Array.from(allPlayers).sort((a, b) =>
        a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())
    );

    return json(sorted);
}
