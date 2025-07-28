import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import {
    validateAndSanitizePlayerName,
    validateDateParameter,
    parseRequestBody,
    validateRequestBody,
    validateList
} from '$lib/shared/validation.js';

export const GET = async ({ url, locals }) => {
    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    try {
        const data = await createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId)
            .getData({ players: true, teams: false, settings: false });
        return json(data.players);
    } catch (err) {
        console.error('Error fetching players:', err);
        return error(500, 'Failed to fetch players');
    }
};

export const POST = async ({ request, url, locals }) => {
    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    const bodyParseResult = await parseRequestBody(request);
    if (!bodyParseResult.isValid) {
        return error(400, bodyParseResult.error);
    }

    // Validate request body structure
    const bodyValidation = validateRequestBody(bodyParseResult.data, ['playerName', 'list']);
    if (!bodyValidation.isValid) {
        return error(400, `Invalid request body: ${bodyValidation.errors.join(', ')}`);
    }

    // Validate and sanitise player name
    const nameValidation = validateAndSanitizePlayerName(bodyParseResult.data.playerName);
    if (!nameValidation.isValid) {
        return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
    }

    // Validate list parameter
    const listValidation = validateList(bodyParseResult.data.list);
    if (!listValidation.isValid) {
        return error(400, `Invalid list parameter: ${listValidation.errors.join(', ')}`);
    }

    try {
        const result = await createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId)
            .addPlayer(nameValidation.sanitizedName, bodyParseResult.data.list);
        return json(result);
    } catch (err) {
        console.error('Error adding player:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to add player');
    }
};

export const DELETE = async ({ request, url, locals }) => {
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

    // Validate and sanitise player name
    const nameValidation = validateAndSanitizePlayerName(bodyParseResult.data.playerName);
    if (!nameValidation.isValid) {
        return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
    }

    try {
        const result = await createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId)
            .removePlayer(nameValidation.sanitizedName);
        return json(result.players);
    } catch (err) {
        console.error('Error removing player:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to remove player');
    }
};

export const PATCH = async ({ request, url, locals }) => {
    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    const bodyParseResult = await parseRequestBody(request);
    if (!bodyParseResult.isValid) {
        return error(400, bodyParseResult.error);
    }

    // Validate request body structure
    const bodyValidation = validateRequestBody(bodyParseResult.data, [
        'playerName',
        'fromList',
        'toList'
    ]);
    if (!bodyValidation.isValid) {
        return error(400, `Invalid request body: ${bodyValidation.errors.join(', ')}`);
    }

    // Validate and sanitise player name
    const nameValidation = validateAndSanitizePlayerName(bodyParseResult.data.playerName);
    if (!nameValidation.isValid) {
        return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
    }

    // Validate fromList parameter
    const fromListValidation = validateList(bodyParseResult.data.fromList);
    if (!fromListValidation.isValid) {
        return error(400, `Invalid fromList parameter: ${fromListValidation.errors.join(', ')}`);
    }

    // Validate toList parameter
    const toListValidation = validateList(bodyParseResult.data.toList);
    if (!toListValidation.isValid) {
        return error(400, `Invalid toList parameter: ${toListValidation.errors.join(', ')}`);
    }

    try {
        const result = await createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId)
            .movePlayer(
                nameValidation.sanitizedName,
                bodyParseResult.data.fromList,
                bodyParseResult.data.toList
            );
        return json(result);
    } catch (err) {
        console.error('Error moving player:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to move player');
    }
};
