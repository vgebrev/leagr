import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';

export async function POST({ locals }) {
    // Validate league exists
    const { isValid: isLeagueValid } = validateLeagueForAPI(locals);
    if (!isLeagueValid) {
        return error(404, 'League not found');
    }

    // Admin status is computed in hooks.server.js from x-admin-code header
    if (locals.isAdmin) {
        return json({ success: true, message: 'Admin authentication successful' });
    }

    return error(401, { message: 'Invalid admin code' });
}
