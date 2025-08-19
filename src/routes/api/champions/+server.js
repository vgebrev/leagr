import { json } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';

/**
 * GET /api/champions - Get champions data for the hall of fame
 */
export async function GET({ locals }) {
    try {
        const leagueId = locals.leagueId;

        if (!leagueId) {
            return json({ error: 'League ID is required' }, { status: 400 });
        }

        const rankingsManager = createRankingsManager().setLeague(leagueId);
        const rankings = await rankingsManager.loadEnhancedRankings();

        // Filter and sort players with championships
        const champions = Object.entries(rankings.players)
            .filter(
                ([, playerData]) =>
                    (playerData.leagueWins || 0) > 0 || (playerData.cupWins || 0) > 0
            )
            .map(([playerName, playerData]) => ({
                playerName,
                leagueWins: playerData.leagueWins || 0,
                cupWins: playerData.cupWins || 0,
                totalChampionships: (playerData.leagueWins || 0) + (playerData.cupWins || 0),
                leagueSessions: Object.entries(playerData.rankingDetail)
                    .filter(([, session]) => session.leagueWinner === true)
                    .map(([date, session]) => ({ date, ...session }))
                    .sort((a, b) => b.date.localeCompare(a.date)), // Sort by date descending
                cupSessions: Object.entries(playerData.rankingDetail)
                    .filter(([, session]) => session.cupWinner === true)
                    .map(([date, session]) => ({ date, ...session }))
                    .sort((a, b) => b.date.localeCompare(a.date)) // Sort by date descending
            }))
            .sort((a, b) => {
                // Sort by total championships first, then league wins, then cup wins
                if (b.totalChampionships !== a.totalChampionships) {
                    return b.totalChampionships - a.totalChampionships;
                }
                if (b.leagueWins !== a.leagueWins) {
                    return b.leagueWins - a.leagueWins;
                }
                return b.cupWins - a.cupWins;
            });

        return json({ champions });
    } catch (error) {
        console.error('Error loading champions data:', error);
        return json(
            {
                error: 'Failed to load champions data',
                details: error.message
            },
            { status: 500 }
        );
    }
}
