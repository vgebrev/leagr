import { json } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { MIN_YEAR, MAX_YEAR } from '$lib/shared/yearConfig.js';

/**
 * GET /api/champions - Get champions data for the hall of fame
 * Query params:
 *   - includeSessionDetails=true to include leagueSessions and cupSessions (default: false)
 *   - year=YYYY to get champions for a specific year, or year=all to aggregate all years (default: current year)
 */
export async function GET({ locals, url }) {
    try {
        const leagueId = locals.leagueId;

        if (!leagueId) {
            return json({ error: 'League ID is required' }, { status: 400 });
        }

        const includeSessionDetails = url.searchParams.get('includeSessionDetails') === 'true';
        const yearParam = url.searchParams.get('year');

        const rankingsManager = createRankingsManager().setLeague(leagueId);

        let allPlayersData = {};

        // If year is "all", aggregate data from all years
        if (yearParam === 'all') {
            for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
                try {
                    const rankings = await rankingsManager.loadEnhancedRankings(year);

                    // Aggregate wins for each player
                    Object.entries(rankings.players).forEach(([playerName, playerData]) => {
                        if (!allPlayersData[playerName]) {
                            allPlayersData[playerName] = {
                                leagueWins: 0,
                                cupWins: 0,
                                rankingDetail: {}
                            };
                        }
                        allPlayersData[playerName].leagueWins += playerData.leagueWins || 0;
                        allPlayersData[playerName].cupWins += playerData.cupWins || 0;

                        // Combine ranking details if needed
                        if (includeSessionDetails && playerData.rankingDetail) {
                            allPlayersData[playerName].rankingDetail = {
                                ...allPlayersData[playerName].rankingDetail,
                                ...playerData.rankingDetail
                            };
                        }
                    });
                } catch {
                    // Year file doesn't exist, skip it
                }
            }
        } else {
            // Load specific year (default to current year)
            const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
            const rankings = await rankingsManager.loadEnhancedRankings(year);
            Object.entries(rankings.players).forEach(([playerName, playerData]) => {
                allPlayersData[playerName] = {
                    leagueWins: playerData.leagueWins || 0,
                    cupWins: playerData.cupWins || 0,
                    rankingDetail: playerData.rankingDetail || {}
                };
            });
        }

        // Filter and sort players with championships
        const champions = Object.entries(allPlayersData)
            .filter(
                ([, playerData]) =>
                    (playerData.leagueWins || 0) > 0 || (playerData.cupWins || 0) > 0
            )
            .map(([playerName, playerData]) => {
                const championData = {
                    playerName,
                    leagueWins: playerData.leagueWins || 0,
                    cupWins: playerData.cupWins || 0,
                    totalChampionships: (playerData.leagueWins || 0) + (playerData.cupWins || 0)
                };

                // Only include session details if requested
                if (includeSessionDetails) {
                    championData.leagueSessions = Object.entries(playerData.rankingDetail || {})
                        .filter(([, session]) => session.leagueWinner === true)
                        .map(([date, session]) => ({ date, ...session }))
                        .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
                    championData.cupSessions = Object.entries(playerData.rankingDetail || {})
                        .filter(([, session]) => session.cupWinner === true)
                        .map(([date, session]) => ({ date, ...session }))
                        .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
                }

                return championData;
            })
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
