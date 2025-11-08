import { json, error } from '@sveltejs/kit';
import { createYearRecapManager } from '$lib/server/yearRecapManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

/**
 * GET /api/year-recap/[year] - Get comprehensive year recap statistics
 * @param {Object} locals - Local variables from SvelteKit request handler
 * @param {Object} params - Route parameters
 * @param {string} params.year - Year to get statistics for
 */
export const GET = async ({ locals, params }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const year = parseInt(params.year, 10);
    if (isNaN(year) || year < 2024 || year > new Date().getFullYear()) {
        return error(400, 'Invalid year');
    }

    try {
        const manager = createYearRecapManager().setLeague(leagueId);
        const stats = await manager.generateYearRecap(year);
        return json(stats);
    } catch (err) {
        console.error('Error loading year recap data:', err);
        if (err.message === 'No data available for this year') {
            return error(404, err.message);
        }
        return error(500, 'Failed to load year recap data');
    }
};
