import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createPlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { createDisciplineManager } from '$lib/server/discipline.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import {
    validateDateParameter,
    parseRequestBody,
    validateRequestBody,
    validateAndSanitizePlayerName,
    validateCompetitionOperationsAllowed
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

    // Validate and sanitise player name
    const nameValidation = validateAndSanitizePlayerName(bodyParseResult.data.playerName);
    if (!nameValidation.isValid) {
        return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
    }

    // The default action is to move to the waiting list, but can be 'remove' for complete removal
    const action = bodyParseResult.data.action || 'waitingList';

    try {
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId)
            .setAccessControl(
                createPlayerAccessControl().setContext(
                    dateValidation.date,
                    leagueId,
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

        if (bodyParseResult.data.teamName) {
            // Player is in a team - use removePlayerFromTeam
            // For no-shows, use 'remove' action to completely remove player like a normal removal
            const effectiveAction = action === 'no-show' ? 'remove' : action;
            await playerManager.removePlayerFromTeam(
                nameValidation.sanitizedName,
                bodyParseResult.data.teamName,
                effectiveAction
            );
        } else {
            // Player is unassigned/waiting - use simple removePlayer for complete removal
            await playerManager.removePlayer(nameValidation.sanitizedName);
        }

        // Handle no-show discipline tracking (only if discipline system is enabled)
        if (action === 'no-show' && gameData.settings.discipline?.enabled !== false) {
            const disciplineManager = createDisciplineManager().setLeague(leagueId);
            await disciplineManager.recordNoShow(nameValidation.sanitizedName, dateValidation.date);
            await disciplineManager.updateSuspensionReadinessIfNeeded(
                nameValidation.sanitizedName,
                gameData.settings
            );
        }

        // Return enhanced data with ELO information for both teams and players
        const enhancedData = await playerManager.getAllDataWithElo();
        const ownedByMe = await playerManager.getOwnedPlayersForCurrentClient();
        return json({ ...enhancedData, ownedByMe });
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

    // Validate and sanitise player name
    const nameValidation = validateAndSanitizePlayerName(bodyParseResult.data.playerName);
    if (!nameValidation.isValid) {
        return error(400, `Invalid player name: ${nameValidation.errors.join(', ')}`);
    }

    try {
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId)
            .setAccessControl(
                createPlayerAccessControl().setContext(
                    dateValidation.date,
                    leagueId,
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

        // Try to assign player to team (works for both available and waiting list players)
        await playerManager.fillEmptySlotWithPlayer(
            bodyParseResult.data.teamName,
            nameValidation.sanitizedName
        );

        // Return enhanced data with ELO information for both teams and players
        const enhancedData = await playerManager.getAllDataWithElo();
        const ownedByMe = await playerManager.getOwnedPlayersForCurrentClient();
        return json({ ...enhancedData, ownedByMe });
    } catch (err) {
        console.error('Error assigning player to team:', err);
        if (err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }
        return error(500, 'Failed to assign player to team');
    }
};
