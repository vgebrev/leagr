import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';

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

    const { accessCode } = requestData;

    // Validate access code
    if (!accessCode || typeof accessCode !== 'string') {
        return error(400, { message: 'Access code is required' });
    }

    // Check if access code matches
    const isValid = accessCode.trim() === locals.leagueInfo.accessCode;

    if (isValid) {
        return json({
            success: true,
            message: 'Authentication successful'
        });
    } else {
        return error(401, { message: 'Invalid access code' });
    }
}
