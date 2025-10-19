import { json, error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';

/**
 * GET /api/champions/[player] - Get trophy session details for a specific champion
 * Query params:
 *   - trophyType=league|cup to only load specific trophy type sessions (optional)
 */
export async function GET({ params, locals, url }) {
    const { player } = params;
    const leagueId = locals.leagueId;
    const trophyType = url.searchParams.get('trophyType'); // 'league', 'cup', or null for both

    if (!player) {
        return error(400, 'Player name is required');
    }

    if (!leagueId) {
        return error(400, 'League ID is required');
    }

    try {
        const rankingsManager = createRankingsManager().setLeague(leagueId);
        const rankings = await rankingsManager.loadEnhancedRankings();

        // Find the specific player
        const playerData = rankings.players[player];

        if (!playerData) {
            return error(404, `Player "${player}" not found in rankings`);
        }

        // Check if player has any championships
        const leagueWins = playerData.leagueWins || 0;
        const cupWins = playerData.cupWins || 0;

        if (leagueWins === 0 && cupWins === 0) {
            return error(404, `Player "${player}" has no championship wins`);
        }

        const response = {
            playerName: player,
            leagueWins,
            cupWins
        };

        // Only include requested trophy type sessions
        if (!trophyType || trophyType === 'league') {
            response.leagueSessions = Object.entries(playerData.rankingDetail)
                .filter(([, session]) => session.leagueWinner === true)
                .map(([date, session]) => ({ date, ...session }))
                .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
        }

        if (!trophyType || trophyType === 'cup') {
            response.cupSessions = Object.entries(playerData.rankingDetail)
                .filter(([, session]) => session.cupWinner === true)
                .map(([date, session]) => ({ date, ...session }))
                .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
        }

        return json(response);
    } catch (err) {
        console.error('Error loading player trophy data:', err);
        return error(500, 'Failed to load player trophy data');
    }
}
