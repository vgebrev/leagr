import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createTeamGenerator, TeamError } from '$lib/server/teamGenerator.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createRankingsManager } from '$lib/server/rankings.js';

export const GET = async ({ url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const date = url.searchParams.get('date');
    if (!date) {
        return error(400, 'Date parameter is required');
    }

    try {
        const gameData = await createPlayerManager()
            .setDate(date)
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

    const date = url.searchParams.get('date');
    const body = await request.json();

    if (!date) {
        return error(400, 'Date parameter is required');
    }

    if (!body || !body.method || !body.teamConfig) {
        return error(400, 'Invalid request body. method and teamConfig are required');
    }

    const { method, teamConfig } = body;

    if (!['random', 'seeded'].includes(method)) {
        return error(400, 'Invalid method. Must be "random" or "seeded"');
    }

    if (!teamConfig.teams || !teamConfig.teamSizes || !Array.isArray(teamConfig.teamSizes)) {
        return error(400, 'Invalid teamConfig. Must include teams and teamSizes array');
    }

    try {
        // Get player data, settings, and rankings
        const playerManager = createPlayerManager().setDate(date).setLeague(leagueId);

        const gameData = await playerManager.getData({
            players: true,
            teams: false,
            settings: true
        });

        // Get rankings for seeded teams
        let rankings = null;
        if (method === 'seeded') {
            rankings = await createRankingsManager().setLeague(leagueId).loadEnhancedRankings();
        }

        // Get eligible players (respecting player limit)
        const effectivePlayerLimit =
            gameData.settings[date]?.playerLimit || gameData.settings.playerLimit;
        const eligiblePlayers = gameData.players.available.slice(
            0,
            Math.min(gameData.players.available.length, effectivePlayerLimit)
        );

        // Generate teams
        const teamGenerator = createTeamGenerator()
            .setSettings(gameData.settings)
            .setPlayers(eligiblePlayers)
            .setRankings(rankings);

        const result = teamGenerator.generateTeams(method, teamConfig);

        // Store the generated teams
        const { data } = await import('$lib/server/data.js');
        await data.set('teams', date, result.teams, {}, true, leagueId);

        // Validate and cleanup any inconsistencies
        const cleanupResult = await playerManager.validateAndCleanup();

        return json({
            teams: cleanupResult.teams,
            config: result.config
        });
    } catch (err) {
        console.error('Error generating teams:', err);

        // Handle known error types with their specific status codes
        if (err instanceof TeamError || err instanceof PlayerError) {
            return error(err.statusCode || 500, err.message);
        }

        // Handle unexpected errors with generic message
        return error(500, 'Failed to generate teams');
    }
};
