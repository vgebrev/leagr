import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI, createLeagueService, LeagueError } from '$lib/server/league.js';

/**
 * Generate and send a reset code for forgotten access codes
 * @param {Object} event - SvelteKit request event
 * @returns {Response} - JSON response with success status
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

    const { email } = requestData;
    const { leagueId, leagueInfo } = locals;

    try {
        const leagueService = createLeagueService();
        const result = await leagueService.generateAccessCodeReset(leagueId, leagueInfo, email);
        return json(result);
    } catch (err) {
        console.error('Error generating reset code:', err);

        // Handle LeagueError with proper status codes
        if (err instanceof LeagueError) {
            // For security, always return success message for client errors
            if (err.statusCode < 500) {
                return json({
                    success: true,
                    message: 'A reset link has been sent to the league organiser email.'
                });
            }
            return error(err.statusCode, { message: err.message });
        }

        // Handle unexpected errors with generic message for security
        return json({
            success: true,
            message: 'A reset link has been sent to the league organiser email.'
        });
    }
}
