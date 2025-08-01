import { redirect } from '@sveltejs/kit';
import { defaultSettings } from '$lib/shared/defaults.js';
import { getConsolidatedSettings } from '$lib/server/settings.js';
import { dateString } from '$lib/shared/helpers.js';

const API_KEY = process.env.API_KEY || import.meta.env.VITE_API_KEY;
const APP_URL = process.env.APP_URL || import.meta.env.VITE_APP_URL;

export const load = async ({ locals, url }) => {
    const { leagueId, leagueInfo } = locals;

    // If we have no league or a league that doesn't exist,
    // redirect all routes except home and auth routes to the home page for registration
    const publicRoutes = ['/', '/auth', '/auth/forgot', '/auth/reset'];
    if (!leagueInfo && !publicRoutes.includes(url.pathname)) {
        throw redirect(302, '/');
    }

    // Load settings server-side to ensure proper league context
    const date = url.searchParams.get('date') || dateString(new Date());
    const settings = leagueInfo
        ? await getConsolidatedSettings(date, leagueInfo.id)
        : defaultSettings;

    // Strip access code from league info before sending to the client
    const clientLeagueInfo = leagueInfo
        ? {
              id: leagueInfo.id,
              name: leagueInfo.name,
              icon: leagueInfo.icon,
              hasOwnerEmail: !!leagueInfo.ownerEmail
          }
        : null;

    return {
        apiKey: API_KEY,
        appUrl: APP_URL,
        leagueId,
        leagueInfo: clientLeagueInfo,
        date,
        settings
    };
};
