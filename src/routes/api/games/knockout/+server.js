import { error, json } from '@sveltejs/kit';
import { toApiError } from '$lib/server/apiError.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createKnockoutManager } from '$lib/server/knockoutManager.js';
import {
    validateDateParameter,
    parseRequestBody,
    validateCompetitionOperationsAllowed,
    validateMatchScorers,
    validateGameScore
} from '$lib/shared/validation.js';
import { getConsolidatedSettings } from '$lib/server/settings.js';
import { data } from '$lib/server/data.js';

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
        const knockoutManager = createKnockoutManager();
        const knockoutGames = await knockoutManager.getBracket(dateValidation.date, leagueId);

        return json({ knockoutGames });
    } catch (err) {
        return toApiError(err, 'Failed to fetch knockout games data', {
            date: dateValidation.date,
            leagueId
        });
    }
};

export const POST = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    // Validate date parameter
    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    // Parse and validate request body
    const bodyValidation = await parseRequestBody(request);
    if (!bodyValidation.isValid) {
        return error(400, bodyValidation.error);
    }

    try {
        // Get settings for validation
        const settings = await getConsolidatedSettings(dateValidation.date, leagueId);

        // Validate if operations are allowed based on competition end state
        const operationValidation = validateCompetitionOperationsAllowed(
            dateValidation.date,
            settings,
            locals.adminUnlockDate
        );
        if (!operationValidation.isValid) {
            return error(400, operationValidation.error);
        }

        const knockoutManager = createKnockoutManager();
        const requestData = bodyValidation.data;

        if (requestData.operation === 'generate') {
            const knockoutGames = await knockoutManager.createTournament(
                dateValidation.date,
                leagueId
            );

            return json({ knockoutGames });
        } else if (requestData.operation === 'updateScores') {
            if (!requestData.bracket) {
                return error(400, 'Bracket data is required for score updates');
            }

            const teams = await data.get('teams', dateValidation.date, leagueId);

            for (const match of requestData.bracket) {
                // Scorer checks need the team rosters; skip them if teams aren't set yet.
                if (teams && (match.homeScorers || match.awayScorers)) {
                    const scorerValidation = validateMatchScorers(match, teams);
                    if (!scorerValidation.isValid) {
                        return error(
                            400,
                            `Scorer validation failed: ${scorerValidation.errors.join(', ')}`
                        );
                    }
                }

                // Penalty checks don't depend on rosters, so they run either way.
                if (match.homePenalties != null || match.awayPenalties != null) {
                    if ((match.homePenalties == null) !== (match.awayPenalties == null)) {
                        return error(400, 'Both home and away penalty scores must be set together');
                    }
                    const hv = validateGameScore(match.homePenalties, 'Home penalties');
                    const av = validateGameScore(match.awayPenalties, 'Away penalties');
                    if (!hv.isValid || !av.isValid) {
                        return error(400, [...hv.errors, ...av.errors].join(', '));
                    }
                    // A shootout only means anything on a draw. Editing a goalscorer shifts
                    // the score, so rejecting here would strand the edit — every order of
                    // "swap one scorer for another" passes through a non-draw state. Drop the
                    // stale shootout instead.
                    if (match.homeScore !== match.awayScore) {
                        match.homePenalties = null;
                        match.awayPenalties = null;
                    }
                }
            }

            const knockoutGames = await knockoutManager.updateScores(
                dateValidation.date,
                requestData.bracket,
                leagueId
            );

            return json({ knockoutGames });
        } else {
            return error(400, 'Invalid operation. Supported operations: generate, updateScores');
        }
    } catch (err) {
        return toApiError(err, 'Internal server error processing knockout tournament', {
            date: dateValidation.date,
            leagueId,
            operation: bodyValidation.data?.operation
        });
    }
};
