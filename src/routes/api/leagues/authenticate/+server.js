import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI, LeagueError } from '$lib/server/league.js';

export async function POST({ request, locals }) {
    try {
        // Validate league exists
        const { isValid: isLeagueValid } = validateLeagueForAPI(locals);
        if (!isLeagueValid) {
            return error(404, 'League not found');
        }

        const { accessCode } = await request.json();

        // Validate access code
        if (!accessCode || typeof accessCode !== 'string') {
            throw new LeagueError('Access code is required', 400);
        }

        console.log('Access code check', accessCode, locals.leagueInfo);
        // Check if access code matches
        const isValid = accessCode.trim() === locals.leagueInfo.accessCode;

        if (isValid) {
            return json({
                success: true,
                message: 'Authentication successful'
            });
        } else {
            throw new LeagueError('Invalid access code', 401);
        }
    } catch (err) {
        console.error('Authentication error:', err);

        // Handle LeagueError with proper status codes
        if (err instanceof LeagueError) {
            return error(err.statusCode, { message: err.message });
        }

        // Handle unexpected errors
        return error(500, { message: 'Authentication failed' });
    }
}
