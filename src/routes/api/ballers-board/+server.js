import { json } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { MIN_YEAR, MAX_YEAR } from '$lib/shared/yearConfig.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

/**
 * GET /api/ballers-board - Get individual stats leaderboard
 * Query params:
 *   - year=YYYY to get stats for a specific year, or year=all to aggregate all years (default: current year)
 */
export async function GET({ locals, url }) {
    try {
        const { leagueId, isValid } = validateLeagueForAPI(locals);
        if (!isValid) {
            return json({ error: 'League not found' }, { status: 404 });
        }

        const yearParam = url.searchParams.get('year');
        const rankingsManager = createRankingsManager().setLeague(leagueId);

        /** @type {Record<string, {appearances: number, saves: number, defence: number, attack: number, goals: number}>} */
        const totals = {};

        /**
         * Merge a player's stats from a rankings entry into totals
         * @param {string} playerName
         * @param {object} playerData
         */
        function mergePlayer(playerName, playerData) {
            if (!totals[playerName]) {
                totals[playerName] = {
                    appearances: 0,
                    saves: 0,
                    defence: 0,
                    attack: 0,
                    goals: 0
                };
            }
            totals[playerName].appearances += playerData.appearances || 0;
            totals[playerName].saves += playerData.saveActions || 0;
            totals[playerName].defence += playerData.defActions || 0;
            totals[playerName].attack += playerData.offActions || 0;
            totals[playerName].goals += playerData.indGoals || 0;
        }

        if (yearParam === 'all') {
            for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
                try {
                    const rankings = await rankingsManager.loadEnhancedRankings(year);
                    Object.entries(rankings.players).forEach(([playerName, playerData]) => {
                        mergePlayer(playerName, playerData);
                    });
                } catch {
                    // Year file doesn't exist, skip
                }
            }
        } else {
            const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
            const rankings = await rankingsManager.loadEnhancedRankings(year);
            Object.entries(rankings.players).forEach(([playerName, playerData]) => {
                mergePlayer(playerName, playerData);
            });
        }

        const ballers = Object.entries(totals)
            .map(([playerName, stats]) => ({
                playerName,
                appearances: stats.appearances,
                saves: stats.saves,
                defence: stats.defence,
                attack: stats.attack,
                goals: stats.goals,
                total: stats.saves + stats.defence + stats.attack + stats.goals
            }))
            .filter((p) => p.appearances > 0)
            .sort((a, b) => b.total - a.total || b.goals - a.goals || b.attack - a.attack);

        return json({ ballers });
    } catch (error) {
        console.error('Error loading ballers board data:', error);
        return json(
            { error: 'Failed to load ballers board data', details: error.message },
            { status: 500 }
        );
    }
}
