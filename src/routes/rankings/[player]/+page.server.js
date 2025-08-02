import { error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

/**
 * Calculate historical rank progression for a player
 * @param {Object} rankings - Full rankings data
 * @param {string} player - Player name
 * @param {Array} sortedDetails - Player's session details sorted by date
 * @param {Object} rankingsManager - Rankings manager instance
 * @returns {Promise<Array>} Array of rank progression points
 */
async function calculateHistoricalRanks(rankings, player, sortedDetails, rankingsManager) {
    const progression = [];

    // Get all unique dates in chronological order (oldest first)
    const playerDates = sortedDetails.map((d) => d.date).reverse();

    for (const targetDate of playerDates) {
        // Calculate cumulative points for all players up to this date
        const playersAtDate = {};

        Object.entries(rankings.players).forEach(([playerName, playerData]) => {
            let cumulativePoints = 0;
            let appearances = 0;

            // Sum points from all sessions up to and including targetDate
            Object.entries(playerData.rankingDetail || {}).forEach(([date, detail]) => {
                if (date <= targetDate) {
                    cumulativePoints += detail.totalPoints;
                    appearances += 1;
                }
            });

            if (appearances > 0) {
                playersAtDate[playerName] = {
                    points: cumulativePoints,
                    appearances: appearances,
                    rawAverage: cumulativePoints / appearances
                };
            }
        });

        // Apply ranking algorithm to get ranking points for this date
        const enhancedPlayersAtDate = rankingsManager.calculateEnhancedRankings({
            players: Object.fromEntries(
                Object.entries(playersAtDate).map(([name, data]) => [
                    name,
                    {
                        points: data.points,
                        appearances: data.appearances,
                        rankingDetail: {} // Not needed for ranking calculation
                    }
                ])
            )
        });

        // Sort players by ranking points (same logic as main rankings)
        const sortedPlayers = Object.entries(enhancedPlayersAtDate.players).sort((a, b) => {
            if (b[1].rankingPoints !== a[1].rankingPoints)
                return b[1].rankingPoints - a[1].rankingPoints;
            return b[1].points - a[1].points;
        });

        // Find our player's rank
        const playerRank = sortedPlayers.findIndex(([playerName]) => playerName === player) + 1;

        if (playerRank > 0) {
            progression.push({
                date: targetDate,
                rank: playerRank,
                totalPlayers: sortedPlayers.length,
                points: playersAtDate[player].points,
                appearances: playersAtDate[player].appearances
            });
        }
    }

    return progression;
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    const rankingsManager = createRankingsManager().setLeague(leagueId);

    try {
        // Load enhanced rankings data
        const rankings = await rankingsManager.loadEnhancedRankings();

        // Find the specific player
        const playerData = rankings.players[player];

        if (!playerData) {
            throw error(404, `Player "${player}" not found in rankings`);
        }

        // Sort ranking details by date (newest first)
        const sortedDetails = Object.entries(playerData.rankingDetail || {})
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, detail]) => ({ date, ...detail }));

        // Calculate historical rank progression
        const rankProgression = await calculateHistoricalRanks(
            rankings,
            player,
            sortedDetails,
            rankingsManager
        );

        return {
            player,
            playerData: {
                ...playerData,
                sortedDetails,
                rankProgression
            },
            rankingMetadata: rankings.rankingMetadata
        };
    } catch (err) {
        if (err.status) {
            throw err;
        }

        console.error('Error loading player rankings:', err);
        throw error(500, 'Failed to load player ranking details');
    }
}
