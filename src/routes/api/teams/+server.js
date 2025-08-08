import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createTeamGenerator, TeamError } from '$lib/server/teamGenerator.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createRankingsManager } from '$lib/server/rankings.js';
import { data } from '$lib/server/data.js';
import {
    validateDateParameter,
    parseRequestBody,
    validateRequestBody,
    validateCompetitionOperationsAllowed
} from '$lib/shared/validation.js';

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
        const gameData = await createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId)
            .getData({ players: false, teams: true, settings: false });
        return json(gameData.teams);
    } catch (err) {
        console.error('Error fetching teams:', err);
        return error(500, 'Failed to fetch teams');
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
    const bodyValidation = validateRequestBody(bodyParseResult.data, ['method', 'teamConfig']);
    if (!bodyValidation.isValid) {
        return error(400, `Invalid request body: ${bodyValidation.errors.join(', ')}`);
    }

    const { method, teamConfig } = bodyParseResult.data;

    if (!['random', 'seeded'].includes(method)) {
        return error(400, 'Invalid method. Must be "random" or "seeded"');
    }

    if (!teamConfig.teams || !teamConfig.teamSizes || !Array.isArray(teamConfig.teamSizes)) {
        return error(400, 'Invalid teamConfig. Must include teams and teamSizes array');
    }

    try {
        // Get player data, settings, and rankings
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId);

        const gameData = await playerManager.getData({
            players: true,
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

        // Get rankings for seeded teams
        let rankings = null;
        if (method === 'seeded') {
            rankings = await createRankingsManager().setLeague(leagueId).loadEnhancedRankings();
        }

        // Get eligible players (respecting player limit)
        const effectivePlayerLimit =
            gameData.settings[dateValidation.date]?.playerLimit || gameData.settings.playerLimit;
        const eligiblePlayers = gameData.players.available.slice(
            0,
            Math.min(gameData.players.available.length, effectivePlayerLimit)
        );

        // Generate teams with history recording enabled
        const teamGenerator = createTeamGenerator()
            .setSettings(gameData.settings)
            .setPlayers(eligiblePlayers)
            .setRankings(rankings)
            .setHistoryRecording(true);

        const result = teamGenerator.generateTeams(method, teamConfig);

        // Store the generated teams and draw history
        await data.set('teams', dateValidation.date, result.teams, {}, true, leagueId);

        // Store draw history if it exists
        if (result.drawHistory) {
            await data.set(
                'drawHistory',
                dateValidation.date,
                result.drawHistory,
                {},
                true,
                leagueId
            );
        }

        // Validate and clean-up any inconsistencies
        const cleanupResult = await playerManager.validateAndCleanup();

        return json({
            teams: cleanupResult.teams,
            config: result.config
        });
    } catch (err) {
        console.error('Error generating teams:', err);

        // Handle known error types with their specific status codes
        if (err instanceof TeamError || err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }

        // Handle unexpected errors with a generic message
        return error(500, 'Failed to generate teams');
    }
};
