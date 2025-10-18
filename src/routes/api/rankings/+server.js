import { json, error } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { createAvatarManager } from '$lib/server/avatarManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';

export const GET = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await createRankingsManager().setLeague(leagueId).loadEnhancedRankings();
    const avatarsData = await createAvatarManager().setLeague(leagueId).loadAvatars();

    // Strip rankingDetail data and merge avatar data for API endpoint
    const strippedRankings = {
        ...rankingsData,
        players: Object.fromEntries(
            Object.entries(rankingsData.players).map(([name, playerData]) => [
                name,
                {
                    ...playerData,
                    rankingDetail: undefined,
                    // Merge avatar data from avatars.json
                    avatar: avatarsData[name]?.avatar || null,
                    pendingAvatar: avatarsData[name]?.pendingAvatar || null
                }
            ])
        )
    };

    return json(strippedRankings);
};

export const POST = async ({ locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const rankingsData = await createRankingsManager().setLeague(leagueId).updateRankings();
    const avatarsData = await createAvatarManager().setLeague(leagueId).loadAvatars();

    // Strip rankingDetail data and merge avatar data for API endpoint
    const strippedRankings = {
        ...rankingsData,
        players: Object.fromEntries(
            Object.entries(rankingsData.players).map(([name, playerData]) => [
                name,
                {
                    ...playerData,
                    rankingDetail: undefined,
                    // Merge avatar data from avatars.json
                    avatar: avatarsData[name]?.avatar || null,
                    pendingAvatar: avatarsData[name]?.pendingAvatar || null
                }
            ])
        )
    };

    return json(strippedRankings);
};
