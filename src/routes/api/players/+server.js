import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createPlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { createDisciplineManager, DisciplineError } from '$lib/server/discipline.js';
import { createRankingsManager } from '$lib/server/rankings.js';
import {
    validateAndSanitizePlayerName,
    validateDateParameter,
    parseRequestBody,
    validateRequestBody,
    validateList,
    validateCompetitionOperationsAllowed
} from '$lib/shared/validation.js';

export const GET = async ({ url, locals }) => {
    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    try {
        const manager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId)
            .setAccessControl(
                createPlayerAccessControl().setContext(
                    dateValidation.date,
                    locals.leagueId,
                    locals.clientId,
                    false
                )
            );
        const data = await manager.getData({ players: true, teams: false, settings: false });
        const ownedByMe = await manager.getOwnedPlayersForCurrentClient();
        return json({ ...data.players, ownedByMe });
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

    const playerManager = createPlayerManager()
        .setDate(dateValidation.date)
        .setLeague(locals.leagueId)
        .setAccessControl(
            createPlayerAccessControl().setContext(
                dateValidation.date,
                locals.leagueId,
                // hooks set clientId in locals
                locals.clientId,
                locals.isAdmin
            )
        );

    // Get settings to validate competition state and suspension
    let gameData;
    try {
        gameData = await playerManager.getData({
            players: false,
            teams: false,
            settings: true
        });
    } catch (err) {
        console.error('Error fetching game data:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to fetch game data');
    }

    // Validate if operations are allowed based on competition end state
    const operationValidation = validateCompetitionOperationsAllowed(
        dateValidation.date,
        gameData.settings
    );
    if (!operationValidation.isValid) {
        return error(400, operationValidation.error);
    }

    // Evaluate suspension before allowing signup
    let suspension;
    try {
        suspension = await createDisciplineManager()
            .setLeague(locals.leagueId)
            .evaluateSuspensionOnSignup(
                nameValidation.sanitizedName,
                dateValidation.date,
                gameData.settings
            );
    } catch (err) {
        console.error('Error checking suspension:', err);
        if (err instanceof DisciplineError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to check suspension status');
    }

    if (suspension.suspended) {
        return error(
            400,
            suspension.reason || 'Player is suspended for this session due to no-shows.'
        );
    }

    // Check for similar ranked players (for helpful suggestions)
    let similarPlayer = null;
    try {
        const rankingsManager = createRankingsManager().setLeague(locals.leagueId);
        const similarCheck = await rankingsManager.checkSimilarRankedPlayer(
            nameValidation.sanitizedName
        );
        if (similarCheck.hasSimilar) {
            similarPlayer = {
                suggestedName: similarCheck.suggestedPlayer,
                similarity: similarCheck.similarity
            };
        }
    } catch (err) {
        // Don't fail the registration if similar player check fails
        console.warn('Error checking similar players:', err);
    }

    try {
        const result = await playerManager.addPlayer(
            nameValidation.sanitizedName,
            bodyParseResult.data.list
        );

        const ownedByMe = await playerManager.getOwnedPlayersForCurrentClient();
        // Include similar player suggestion in the response
        return json({
            ...result,
            ownedByMe,
            ...(similarPlayer && { similarPlayer })
        });
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
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId)
            .setAccessControl(
                createPlayerAccessControl().setContext(
                    dateValidation.date,
                    locals.leagueId,
                    locals.clientId,
                    locals.isAdmin
                )
            );

        // Get settings to validate competition state
        const gameData = await playerManager.getData({
            players: false,
            teams: false,
            settings: true
        });

        // Validate if operations are allowed based on competition end state
        const operationValidation = validateCompetitionOperationsAllowed(
            dateValidation.date,
            gameData.settings
        );
        if (!operationValidation.isValid) {
            return error(400, operationValidation.error);
        }

        const result = await playerManager.removePlayer(nameValidation.sanitizedName);
        const ownedByMe = await playerManager.getOwnedPlayersForCurrentClient();
        return json({ ...result.players, ownedByMe });
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
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(locals.leagueId)
            .setAccessControl(
                createPlayerAccessControl().setContext(
                    dateValidation.date,
                    locals.leagueId,
                    locals.clientId,
                    locals.isAdmin
                )
            );

        // Get settings to validate competition state
        const gameData = await playerManager.getData({
            players: false,
            teams: false,
            settings: true
        });

        // Validate if operations are allowed based on competition end state
        const operationValidation = validateCompetitionOperationsAllowed(
            dateValidation.date,
            gameData.settings
        );
        if (!operationValidation.isValid) {
            return error(400, operationValidation.error);
        }

        const result = await playerManager.movePlayer(
            nameValidation.sanitizedName,
            bodyParseResult.data.fromList,
            bodyParseResult.data.toList
        );
        const ownedByMe = await playerManager.getOwnedPlayersForCurrentClient();
        return json({ ...result, ownedByMe });
    } catch (err) {
        console.error('Error moving player:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to move player');
    }
};
