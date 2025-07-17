import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI, createLeagueService, LeagueError } from '$lib/server/league.js';

/**
 * Validate a reset code for access code recovery
 * @param {Object} event - SvelteKit request event
 * @returns {Response} - JSON response with validation status
 */
export async function POST({ request, locals }) {
    // Validate league exists
    const { isValid: isLeagueValid } = validateLeagueForAPI(locals);
    if (!isLeagueValid) {
        return error(404, 'League not found');
    }

    // Parse JSON with error handling
    let requestData;
    try {
        requestData = await request.json();
    } catch (err) {
        console.error('JSON parse error:', err);
        return error(400, { message: 'Invalid JSON payload' });
    }

    const { resetCode } = requestData;
    const { leagueInfo } = locals;

    try {
        const leagueService = createLeagueService();
        const result = leagueService.validateResetCode(leagueInfo, resetCode);
        return json(result);
    } catch (err) {
        console.error('Error validating reset code:', err);

        // Handle LeagueError with proper status codes
        if (err instanceof LeagueError) {
            return error(err.statusCode, { message: err.message });
        }

        // Handle unexpected errors
        return error(500, { message: 'Internal server error' });
    }
}
