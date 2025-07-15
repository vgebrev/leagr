import { redirect } from '@sveltejs/kit';
import { data } from '$lib/server/data.js';
import { defaultSettings } from '$lib/shared/defaults.js';
import { dateString } from '$lib/shared/helpers.js';

const API_KEY = process.env.API_KEY || import.meta.env.VITE_API_KEY;

export const load = async ({ locals, url }) => {
    const { leagueId, leagueInfo } = locals;

    // If we have no league or a league that doesn't exist,
    // redirect all routes except home to the home page for registration
    if (!leagueInfo && url.pathname !== '/') {
        throw redirect(302, '/');
    }

    // Load settings server-side to ensure proper league context
    const date = url.searchParams.get('date') || dateString(new Date());
    const settings = leagueInfo
        ? (await data.get('settings', date, leagueInfo.id)) || defaultSettings
        : defaultSettings;

    return {
        apiKey: API_KEY,
        leagueId,
        leagueInfo,
        date,
        settings
    };
};
