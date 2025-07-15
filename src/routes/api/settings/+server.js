import { error, json } from '@sveltejs/kit';
import { data } from '$lib/server/data.js';
import { defaultSettings } from '$lib/shared/defaults.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const date = url.searchParams.get('date');
    const settings = (await data.get('settings', date, leagueId)) || defaultSettings;
    return json(settings);
};

export const POST = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const date = url.searchParams.get('date');
    const body = await request.json();
    if (!body) {
        return error(400, 'Invalid request body');
    }
    const result = await data.set('settings', date, body, defaultSettings, false, leagueId);
    return result ? json(result) : error(500, 'Failed to set settings');
};
