import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createTeamGenerator, TeamError } from '$lib/server/teamGenerator.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

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
        // Get player data and settings
        const playerManager = createPlayerManager().setDate(date).setLeague(leagueId);

        const gameData = await playerManager.getData({
            players: true,
            teams: false,
            settings: true
        });

        const playerCount = Math.min(
            gameData.players.available.length,
            gameData.settings[date]?.playerLimit || gameData.settings.playerLimit
        );

        // Calculate possible team configurations
        const teamGenerator = createTeamGenerator().setSettings(gameData.settings);

        const configurations = teamGenerator.calculateConfigurations(playerCount);

        return json({
            playerCount,
            configurations
        });
    } catch (err) {
        console.error('Error calculating team configurations:', err);

        // Handle known error types with their specific status codes
        if (err instanceof TeamError || err instanceof PlayerError) {
            return error(err.statusCode || 500, err.message);
        }

        // Handle unexpected errors with generic message
        return error(500, 'Failed to calculate team configurations');
    }
};
