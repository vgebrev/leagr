import { error, json } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createKnockoutManager, KnockoutError } from '$lib/server/knockoutManager.js';
import {
    validateDateParameter,
    parseRequestBody,
    validateCompetitionOperationsAllowed,
    validateMatchScorers
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
        console.error('Error fetching knockout games:', err);

        if (err instanceof KnockoutError) {
            return error(err.statusCode, err.message);
        }

        return error(500, 'Failed to fetch knockout games data');
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
            settings
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

            // Validate scorer data if present
            const teams = await data.get('teams', dateValidation.date, leagueId);
            if (teams && requestData.bracket) {
                for (const match of requestData.bracket) {
                    if (match.homeScorers || match.awayScorers) {
                        const scorerValidation = validateMatchScorers(match, teams);
                        if (!scorerValidation.isValid) {
                            return error(
                                400,
                                `Scorer validation failed: ${scorerValidation.errors.join(', ')}`
                            );
                        }
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
        console.error('Error processing knockout request:', err);

        if (err instanceof KnockoutError) {
            return error(err.statusCode, err.message);
        }

        return error(500, 'Internal server error processing knockout tournament');
    }
};
