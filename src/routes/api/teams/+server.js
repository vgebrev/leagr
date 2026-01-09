import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createTeamGenerator, TeamError } from '$lib/server/teamGenerator.js';
import { createPlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { createRankingsManager } from '$lib/server/rankings.js';
import { createTeammateHistoryTracker } from '$lib/server/teammateHistory.js';
import { createAvatarManager } from '$lib/server/avatarManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
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

    // Check for optional teamName filter
    const teamName = url.searchParams.get('teamName');

    try {
        const manager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId)
            .setAccessControl(
                createPlayerAccessControl().setContext(
                    dateValidation.date,
                    leagueId,
                    locals.clientId,
                    false
                )
            );

        const enhancedData = await manager.getAllDataWithElo();
        const ownedByMe = await manager.getOwnedPlayersForCurrentClient();

        // If teamName is specified, filter to only return that team's data
        if (teamName) {
            const teamData = enhancedData.teams[teamName];
            if (!teamData) {
                return error(404, `Team "${teamName}" not found`);
            }
            return json({
                teams: { [teamName]: teamData },
                ownedByMe
            });
        }

        return json({ ...enhancedData, ownedByMe });
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

        // Get rankings for both seeded and random teams (needed for draw history ELO display)
        // Load current year rankings (with fallback to previous year if current year is empty)
        const currentYear = new Date(dateValidation.date).getFullYear();
        const previousYear = currentYear - 1;

        const rankings = await createRankingsManager()
            .setLeague(leagueId)
            .loadEnhancedRankings(currentYear, { fallbackToPreviousYear: true });

        // Load previous year rankings for players who haven't played yet this year
        const previousYearRankings = await createRankingsManager()
            .setLeague(leagueId)
            .loadEnhancedRankings(previousYear);

        // Load avatars and merge them into rankings data
        const avatars = await createAvatarManager().setLeague(leagueId).loadAvatars();
        if (rankings.players) {
            for (const [playerName, avatarData] of Object.entries(avatars)) {
                if (rankings.players[playerName]) {
                    rankings.players[playerName].avatar = avatarData.avatar || null;
                }
            }
        }
        // Also merge avatars into previous year rankings
        if (previousYearRankings?.players) {
            for (const [playerName, avatarData] of Object.entries(avatars)) {
                if (previousYearRankings.players[playerName]) {
                    previousYearRankings.players[playerName].avatar = avatarData.avatar || null;
                }
            }
        }

        // Load teammate history for variance-conscious team generation
        let teammateHistory = null;
        if (method === 'seeded') {
            try {
                const historyTracker = createTeammateHistoryTracker();
                const { historyData } = await historyTracker.updateTeammateHistory(leagueId, 12);
                teammateHistory = historyData;
            } catch (error) {
                console.warn(
                    'Failed to load teammate history, proceeding without variance consideration:',
                    error.message
                );
            }
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
            .setPreviousYearRankings(previousYearRankings)
            .setTeammateHistory(teammateHistory)
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
        await playerManager.validateAndCleanup();

        // Get the enhanced data with ELO ratings for the response
        const enhancedData = await playerManager.getAllDataWithElo();
        const ownedByMe = await playerManager.getOwnedPlayersForCurrentClient();

        return json({
            teams: enhancedData.teams,
            config: result.config,
            ownedByMe
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
