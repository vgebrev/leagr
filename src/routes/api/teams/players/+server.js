import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import {
    validateDateParameter,
    parseRequestBody,
    validateRequestBody,
    validateAndSanitizePlayerName
} from '$lib/shared/validation.js';

export const DELETE = async ({ request, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    const bodyParseResult = await parseRequestBody(request);
    if (!bodyParseResult.isValid) {
        return error(400, bodyParseResult.error);
    }

    // Validate request body structure
    const bodyValidation = validateRequestBody(bodyParseResult.data, ['playerName']);
    if (!bodyValidation.isValid) {
        return error(400, `Invalid request body: ${bodyValidation.errors.join(', ')}`);
    }

    // Validate and sanitize player name
    const nameValidation = validateAndSanitizePlayerName(bodyParseResult.data.playerName);
    if (!nameValidation.isValid) {
        return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
    }

    // Default action is to move to waiting list, but can be 'remove' for complete removal
    const action = bodyParseResult.data.action || 'waitingList';

    try {
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId);

        let result;
        if (bodyParseResult.data.teamName) {
            // Player is in a team - use removePlayerFromTeam
            result = await playerManager.removePlayerFromTeam(nameValidation.sanitizedName, bodyParseResult.data.teamName, action);
        } else {
            // Player is unassigned/waiting - use simple removePlayer for complete removal
            result = await playerManager.removePlayer(nameValidation.sanitizedName);
        }
        
        return json(result);
    } catch (err) {
        console.error('Error removing player from team:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to remove player from team');
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

    const bodyParseResult = await parseRequestBody(request);
    if (!bodyParseResult.isValid) {
        return error(400, bodyParseResult.error);
    }

    // Validate request body structure
    const bodyValidation = validateRequestBody(bodyParseResult.data, ['playerName', 'teamName']);
    if (!bodyValidation.isValid) {
        return error(400, `Invalid request body: ${bodyValidation.errors.join(', ')}`);
    }

    // Validate and sanitize player name
    const nameValidation = validateAndSanitizePlayerName(bodyParseResult.data.playerName);
    if (!nameValidation.isValid) {
        return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
    }

    try {
        // Try to assign player to team (works for both available and waiting list players)
        const result = await createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId)
            .fillEmptySlotWithPlayer(bodyParseResult.data.teamName, nameValidation.sanitizedName);
        return json(result);
    } catch (err) {
        console.error('Error assigning player to team:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to assign player to team');
    }
};


