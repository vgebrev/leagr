import { error, json } from '@sveltejs/kit';
import { createPlayerManager, PlayerError } from '$lib/server/playerManager.js';
import { createTeamGenerator, TeamError } from '$lib/server/teamGenerator.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { validateDateParameter } from '$lib/shared/validation.js';

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
        // Get player data and settings
        const playerManager = createPlayerManager()
            .setDate(dateValidation.date)
            .setLeague(leagueId);

        const gameData = await playerManager.getData({
            players: true,
            teams: false,
            settings: true
        });

        const settings = gameData.settings;
        const players = gameData.players;
        if (!settings || !players) {
            return error(500, 'Session data could not be loaded');
        }

        const playerCount = Math.min(
            players.available.length,
            settings[dateValidation.date]?.playerLimit || settings.playerLimit
        );

        // Calculate possible team configurations
        const teamGenerator = createTeamGenerator().setSettings(settings);

        const configurations = teamGenerator.calculateConfigurations(playerCount);

        return json({
            playerCount,
            configurations
        });
    } catch (err) {
        console.error('Error calculating team configurations:', err);

        // Handle known error types with their specific status codes
        if (err instanceof TeamError || err instanceof PlayerError) {
            return error(err.statusCode, err.message);
        }

        // Handle unexpected errors with a generic message
        return error(500, 'Failed to calculate team configurations');
    }
};
