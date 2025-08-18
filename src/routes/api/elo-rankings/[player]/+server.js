import { json, error } from '@sveltejs/kit';
import { createEloRankingsManager } from '$lib/server/eloRankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ locals, params }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const { player } = params;

    if (!player) {
        return error(400, 'Player parameter is required');
    }

    const rankings = await createEloRankingsManager().setLeague(leagueId).loadEloRankings();

    const playerData = rankings.players[player];

    if (!playerData) {
        return error(404, 'Player not found in Elo rankings');
    }

    // Get enhanced rankings to include rank information
    const enhancedRankings = await createEloRankingsManager()
        .setLeague(leagueId)
        .getEnhancedEloRankings();

    const enhancedPlayer = enhancedRankings.players.find((p) => p.playerId === player);

    return json({
        playerId: player,
        ...playerData,
        rank: enhancedPlayer?.rank || null,
        totalPlayers: enhancedRankings.metadata.totalPlayers
    });
};
