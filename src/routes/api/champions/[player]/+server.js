import { json, error } from '@sveltejs/kit';
import { toApiError } from '#lib/server/apiError.js';
import { createRankingsManager } from '#lib/server/rankings.js';
import { deriveBallerTops } from '#lib/server/momentum.js';
import { appearanceDetail } from '#lib/server/sessionDetails.js';

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

        /** @type {ChampionEntry} */
        const response = {
            playerName: player,
            leagueWins,
            cupWins
        };

        const ballerTops = deriveBallerTops(rankings.players);

        /**
         * Sessions matching a trophy filter, newest first, with the flattened
         * fields the appearance card renders.
         * @param {(entry: RankingHistoryEntry) => boolean} won
         * @returns {ChampionSession[]}
         */
        const sessionsWhere = (won) =>
            Object.entries(playerData.history)
                .filter(([, entry]) => won(entry))
                .map(([date, entry]) => ({
                    date,
                    ...entry,
                    ...appearanceDetail(entry, ballerTops.get(date))
                }))
                .sort((a, b) => b.date.localeCompare(a.date));

        // Only include requested trophy type sessions
        if (!trophyType || trophyType === 'league') {
            response.leagueSessions = sessionsWhere((e) => e.performance?.leagueWinner === true);
        }

        if (!trophyType || trophyType === 'cup') {
            response.cupSessions = sessionsWhere((e) => e.performance?.cupWinner === true);
        }

        return json(response);
    } catch (err) {
        return toApiError(err, 'Failed to load player trophy data');
    }
}
