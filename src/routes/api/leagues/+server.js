import { error, json } from '@sveltejs/kit';
import { createLeagueService, LeagueError } from '$lib/server/league.js';

export const POST = async ({ request }) => {
    try {
        const leagueData = await request.json();
        const result = await createLeagueService().createLeague(leagueData);
        return json(result);
    } catch (err) {
        console.error('Error creating league:', err);

        // Handle LeagueError with proper status codes
        if (err instanceof LeagueError) {
            return error(err.statusCode, { message: err.message });
        }

        // Handle unexpected errors
        return error(500, { message: 'Failed to create league' });
    }
};
