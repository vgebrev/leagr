import { error, json } from '@sveltejs/kit';
import { createTeamLogoManager } from '$lib/server/teamLogoManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { validateDateParameter } from '$lib/shared/validation.js';

/**
 * GET /api/teams/logos?date=YYYY-MM-DD
 * Returns a map of teamName → true/false indicating which teams have a generated logo.
 */
export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    const logoManager = createTeamLogoManager().setLeague(leagueId);
    const logos = await logoManager.getLogosForDate(dateValidation.date);

    // Return a simple presence map — the actual images are served by the [teamName] route
    const presence = Object.fromEntries(Object.keys(logos).map((name) => [name, true]));
    return json(presence);
};
