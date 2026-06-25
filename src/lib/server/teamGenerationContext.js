import { createRankingsManager } from '$lib/server/rankings.js';
import { createTeammateHistoryTracker } from '$lib/server/teammateHistory.js';
import { createAvatarManager } from '$lib/server/avatarManager.js';
import { logger } from '$lib/server/logger.js';

/**
 * Merge avatar metadata into a rankings players map (in place).
 * @param {{ players?: Record<string, any> } | null} rankings
 * @param {Record<string, { avatar?: string | null }>} avatars
 */
function mergeAvatars(rankings, avatars) {
    if (!rankings?.players) return;
    for (const [playerName, avatarData] of Object.entries(avatars)) {
        if (rankings.players[playerName]) {
            rankings.players[playerName].avatar = avatarData.avatar || null;
        }
    }
}

/**
 * Build the shared context required to seed/score teams for a session: current-year
 * rankings (with previous-year fallback), previous-year rankings, avatar-merged, and
 * teammate history. Used by both the team-draw and auto-assign endpoints.
 *
 * @param {{ leagueId: string, date: string, includeTeammateHistory?: boolean }} params
 * @returns {Promise<{ rankings: any, previousYearRankings: any, teammateHistory: any | null }>}
 */
export async function buildTeamGenerationContext({
    leagueId,
    date,
    includeTeammateHistory = true
}) {
    const currentYear = new Date(date).getFullYear();
    const previousYear = currentYear - 1;

    const rankings = await createRankingsManager()
        .setLeague(leagueId)
        .loadEnhancedRankings(currentYear, { fallbackToPreviousYear: true });

    const previousYearRankings = await createRankingsManager()
        .setLeague(leagueId)
        .loadEnhancedRankings(previousYear);

    // Merge avatars into both rankings sets so generated/draw data carries avatar info
    const avatars = await createAvatarManager().setLeague(leagueId).loadAvatars();
    mergeAvatars(rankings, avatars);
    mergeAvatars(previousYearRankings, avatars);

    let teammateHistory = null;
    if (includeTeammateHistory) {
        try {
            const historyTracker = createTeammateHistoryTracker();
            const { historyData } = await historyTracker.updateTeammateHistory(leagueId, 10, date);
            teammateHistory = historyData;
        } catch (error) {
            logger.warn(
                `[teams] Failed to load teammate history, proceeding without it: ${error.message}`
            );
        }
    }

    return { rankings, previousYearRankings, teammateHistory };
}
