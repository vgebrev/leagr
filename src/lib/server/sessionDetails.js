import { ballerAwards } from './momentum.js';

/**
 * The appearance-card fields for one session, flattened from the player's
 * rankings history entry. Empty for a session the player missed.
 * @param {RankingHistoryEntry} entry - the player's history entry for the date
 * @param {Record<string, number|null>|undefined} dateTops - that date's entry from deriveBallerTops
 * @returns {AppearanceDetail}
 */
export function appearanceDetail(entry, dateTops) {
    const { points, performance } = entry;
    if (points == null) return {};
    return {
        team: entry.team,
        appearancePoints: points.appearance || 0,
        matchPoints: points.match || 0,
        bonusPoints: points.bonus || 0,
        knockoutPoints: points.knockout || 0,
        totalPoints: points.total || 0,
        leagueWinner: performance?.leagueWinner || false,
        cupWinner: performance?.cupWinner || false,
        eloRating: entry.ratings.elo || 1000,
        leaguePosition: performance?.leaguePosition ?? null,
        cupProgress: performance?.cupProgress,
        awards: ballerAwards(entry.stats, dateTops)
    };
}
