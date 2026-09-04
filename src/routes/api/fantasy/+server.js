import { error, json } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createFantasyManager, FantasyError } from '$lib/server/fantasyManager.js';
import { createPlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { validateDateParameter, parseRequestBody } from '$lib/shared/validation.js';

/**
 * Build a manager bound to the request's league, date and client identity.
 * @param {string} leagueId
 * @param {string} date
 * @param {App.Locals} locals
 */
function managerFor(leagueId, date, locals) {
    return createFantasyManager()
        .setLeague(leagueId)
        .setDate(date)
        .setAccessControl(
            createPlayerAccessControl().setContext(date, leagueId, locals.clientId, locals.isAdmin)
        );
}

/**
 * Translate manager failures into responses, preserving their status codes.
 * @param {unknown} err
 * @param {string} context
 */
function toErrorResponse(err, context) {
    console.error(context, err);
    if (err instanceof FantasyError) {
        return error(err.statusCode, err.message);
    }
    return error(500, context);
}

export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    try {
        const state = await managerFor(leagueId, dateValidation.date, locals).getState({
            adminUnlockDate: locals.adminUnlockDate
        });
        return json(state);
    } catch (err) {
        return toErrorResponse(err, 'Failed to load fantasy session');
    }
};

export const POST = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    const bodyValidation = await parseRequestBody(request);
    if (!bodyValidation.isValid) {
        return error(400, bodyValidation.error);
    }

    try {
        const { teamName, players } = bodyValidation.data ?? {};
        const state = await managerFor(leagueId, dateValidation.date, locals).saveEntry(
            { teamName, players },
            { adminUnlockDate: locals.adminUnlockDate }
        );
        return json(state);
    } catch (err) {
        return toErrorResponse(err, 'Failed to save fantasy squad');
    }
};

export const DELETE = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    try {
        const state = await managerFor(leagueId, dateValidation.date, locals).deleteEntry({
            adminUnlockDate: locals.adminUnlockDate
        });
        return json(state);
    } catch (err) {
        return toErrorResponse(err, 'Failed to withdraw fantasy squad');
    }
};
