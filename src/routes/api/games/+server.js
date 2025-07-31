import { error, json } from '@sveltejs/kit';
import { data } from '$lib/server/data.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createGameScheduler, GameSchedulerError } from '$lib/server/gameScheduler.js';
import { validateDateParameter, parseRequestBody } from '$lib/shared/validation.js';

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
        const games = (await data.get('games', dateValidation.date, leagueId)) || {};
        return json(games);
    } catch (err) {
        console.error('Error fetching games:', err);
        return error(500, 'Failed to fetch games data');
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
        const gameScheduler = createGameScheduler();
        const requestData = bodyValidation.data;

        // Handle different types of game operations
        if (requestData.operation === 'generate') {
            // Generate new schedule
            const teams = await getTeamsForDate(dateValidation.date, leagueId);
            if (!teams || Object.keys(teams).length === 0) {
                return error(400, 'No teams available for schedule generation');
            }

            const teamNames = Object.keys(teams);
            const scheduleData = gameScheduler
                .setTeams(teamNames)
                .processScheduleRequest({
                    teams: teamNames,
                    anchorIndex: requestData.anchorIndex
                });

            const result = await data.set('games', dateValidation.date, scheduleData, {}, false, leagueId);
            return result ? json(result) : error(500, 'Failed to save schedule');

        } else if (requestData.operation === 'addMore') {
            // Add more rounds to existing schedule
            const existingGames = (await data.get('games', dateValidation.date, leagueId)) || {};
            const teams = await getTeamsForDate(dateValidation.date, leagueId);
            
            if (!teams || Object.keys(teams).length === 0) {
                return error(400, 'No teams available for adding more games');
            }

            const teamNames = Object.keys(teams);
            const scheduleData = gameScheduler
                .setTeams(teamNames)
                .processScheduleRequest({
                    teams: teamNames,
                    anchorIndex: requestData.anchorIndex || existingGames.anchorIndex || 0,
                    existingRounds: existingGames.rounds || [],
                    addMore: true
                });

            const result = await data.set('games', dateValidation.date, scheduleData, {}, false, leagueId);
            return result ? json(result) : error(500, 'Failed to save extended schedule');

        } else {
            // Update existing schedule (scores, etc.)
            const validatedData = gameScheduler.validateGameRequest(requestData);
            
            // Add schedule status information
            const status = gameScheduler.getScheduleStatus(validatedData.rounds);
            const dataWithStatus = {
                ...validatedData,
                status
            };

            const result = await data.set('games', dateValidation.date, dataWithStatus, {}, false, leagueId);
            return result ? json(result) : error(500, 'Failed to save games');
        }

    } catch (err) {
        console.error('Error processing games request:', err);
        
        if (err instanceof GameSchedulerError) {
            return error(err.statusCode, err.message);
        }
        
        return error(500, 'Internal server error processing games');
    }
};

/**
 * Helper function to get teams for a specific date
 * @param {string} date - Date string
 * @param {string} leagueId - League identifier
 * @returns {Promise<Object>} Teams data
 */
async function getTeamsForDate(date, leagueId) {
    try {
        return await data.get('teams', date, leagueId);
    } catch (err) {
        console.error('Error fetching teams:', err);
        return null;
    }
}
