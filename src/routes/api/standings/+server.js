import { error, json } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { validateDateParameter } from '$lib/shared/validation.js';
import { createStandingsManager, StandingsError } from '$lib/server/standings.js';

export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    // Validate date parameter
    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    try {
        const standingsManager = createStandingsManager();
        const standings = await standingsManager.getStandingsForDate(dateValidation.date, leagueId);

        return json({
            standings,
            date: dateValidation.date,
            teamCount: standings.length
        });
    } catch (err) {
        console.error('Error fetching standings:', err);

        if (err instanceof StandingsError) {
            return error(err.statusCode, err.message);
        }

        return error(500, 'Failed to fetch standings data');
    }
};
