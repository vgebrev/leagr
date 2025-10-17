import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createAvatarManager } from '$lib/server/avatarManager.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
    // Admin only
    if (!locals.isAdmin) {
        throw error(403, 'Admin access required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    const avatarManager = createAvatarManager().setLeague(leagueId);

    try {
        const pending = await avatarManager.getPendingAvatars();

        return json({
            pending,
            count: pending.length
        });
    } catch (err) {
        console.error('Error fetching pending avatars:', err);
        throw error(500, 'Failed to fetch pending avatars');
    }
}
