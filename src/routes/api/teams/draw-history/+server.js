import { error, json } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { validateDateParameter } from '$lib/shared/validation.js';
import { data } from '$lib/server/data.js';

export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    let drawHistory;
    try {
        drawHistory = await data.get('drawHistory', dateValidation.date, leagueId);
    } catch (err) {
        console.error('Error fetching draw history:', err);
        return error(500, 'Failed to fetch draw history');
    }

    // If no draw history exists, return 404 as expected
    if (!drawHistory) {
        return error(404, 'No draw history found for this date');
    }

    return json(drawHistory);
};
