import { error, json } from '@sveltejs/kit';
import { getConsolidatedSettings, saveConsolidatedSettings } from '$lib/server/settings.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const date = url.searchParams.get('date');
    const settings = await getConsolidatedSettings(date, leagueId);
    return json(settings);
};

export const POST = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    // Require admin privileges to update settings. Use 401 to avoid client logout redirect.
    if (!locals.isAdmin) {
        return error(401, 'Admin privileges required to update settings');
    }

    const date = url.searchParams.get('date');
    const body = await request.json();
    if (!body) {
        return error(400, 'Invalid request body');
    }

    try {
        const result = await saveConsolidatedSettings(date, leagueId, body);
        return json(result);
    } catch (err) {
        console.error('Error saving settings:', err);
        return error(500, err.message || 'Failed to save settings');
    }
};
