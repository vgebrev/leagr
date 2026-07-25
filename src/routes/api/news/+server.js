import fs from 'node:fs/promises';
import { json } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { getLeagueInfo, getLeagueDataPath } from '$lib/server/league.js';
import { getEffectiveLeagueSettings } from '$lib/shared/defaults.js';
import { resolveMomentumConfig } from '$lib/server/momentum.js';
import { buildNewsFeed, previewSessionDate } from '$lib/server/newsFeed.js';
import { createStandingsManager } from '$lib/server/standings.js';
import { data } from '$lib/server/data.js';
import { dateString } from '$lib/shared/helpers.js';

/**
 * Session standings (points, goal difference, wins/losses) per played date.
 * The recap's team lines need data that isn't in the rankings history: the
 * goal-difference margin when the top two are level on points, and each
 * winning team's league losses (to flag an unbeaten "invincible" side).
 * @param {Set<string>} playedDates
 * @param {string} asOf
 * @param {string} leagueId
 * @returns {Promise<Record<string, Array>>}
 */
async function loadSessionStandings(playedDates, asOf, leagueId) {
    const standingsManager = createStandingsManager();
    /** @type {Record<string, Array>} */
    const standingsByDate = {};
    await Promise.all(
        [...playedDates]
            .filter((date) => date <= asOf)
            .map(async (date) => {
                try {
                    const table = await standingsManager.getStandingsForDate(date, leagueId);
                    if (table.length > 0) standingsByDate[date] = table;
                } catch {
                    // A session without recorded games has no standings - skip it
                }
            })
    );
    return standingsByDate;
}

/**
 * The soonest upcoming session that has players registered but no results yet.
 * A session can be scheduled off the usual competition day (e.g. a public
 * holiday), so we look at actual session files rather than only the
 * competition-day calendar. Returns the earliest such date, or null.
 * @param {string} leagueId
 * @param {string} asOf - viewing clock (YYYY-MM-DD)
 * @param {Set<string>} playedDates - dates already in rankings history
 * @returns {Promise<string|null>}
 */
async function earliestRegisteredSession(leagueId, asOf, playedDates) {
    let files;
    try {
        files = await fs.readdir(getLeagueDataPath(leagueId));
    } catch {
        return null;
    }
    const upcoming = files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .map((f) => f.slice(0, -'.json'.length))
        .filter((date) => date >= asOf && !playedDates.has(date))
        .sort();
    for (const date of upcoming) {
        const registration = await data.get('players', date, leagueId);
        const count =
            (registration?.available?.length ?? 0) + (registration?.waitingList?.length ?? 0);
        if (count > 0) return date;
    }
    return null;
}

/**
 * GET /api/news - Session preview/recap news feed derived from momentum
 * Query params:
 *   - asOf=YYYY-MM-DD to view the feed as it stood at a past date (default: today)
 */
export async function GET({ locals, url }) {
    try {
        const leagueId = locals.leagueId;

        if (!leagueId) {
            return json({ error: 'League ID is required' }, { status: 400 });
        }

        const asOfParam = url.searchParams.get('asOf');
        if (asOfParam && !/^\d{4}-\d{2}-\d{2}$/.test(asOfParam)) {
            return json({ error: 'asOf must be formatted YYYY-MM-DD' }, { status: 400 });
        }
        const today = dateString(new Date());
        const asOf = asOfParam && asOfParam <= today ? asOfParam : today;

        const settings = getEffectiveLeagueSettings(getLeagueInfo(leagueId));
        const config = resolveMomentumConfig(settings);
        if (!config.enabled) {
            return json({ cards: null });
        }

        // The feed, like momentum, is a current-year signal
        const year = new Date(asOf).getFullYear();
        const rankings = await createRankingsManager()
            .setLeague(leagueId)
            .loadEnhancedRankings(year);

        const competitionDays = settings.competitionDays;

        // The preview card describes the next upcoming session. Normally that's
        // the next competition day, but a session can be scheduled off-calendar
        // (e.g. a public holiday) - if players have already registered for an
        // earlier date, that registered session is the one going in.
        const playedDates = new Set(
            Object.values(rankings.players).flatMap((p) => Object.keys(p.history ?? {}))
        );
        const nextCompetition = previewSessionDate(rankings.players, { asOf, competitionDays });
        const registeredSession = await earliestRegisteredSession(leagueId, asOf, playedDates);
        const previewDate =
            registeredSession && registeredSession < nextCompetition
                ? registeredSession
                : nextCompetition;

        // Gate the preview to the roster registered for that session (available
        // + waiting list), which lives in the daily session file.
        const registration = await data.get('players', previewDate, leagueId);
        const registeredPlayers = registration
            ? [...(registration.available ?? []), ...(registration.waitingList ?? [])]
            : [];

        const standingsByDate = await loadSessionStandings(playedDates, asOf, leagueId);

        const cards = buildNewsFeed(
            rankings.players,
            { champions: config.champions, ballers: config.ballers },
            { asOf, competitionDays, previewDate, registeredPlayers, standingsByDate }
        );

        return json({ cards });
    } catch (error) {
        console.error('Error building news feed:', error);
        return json(
            { error: 'Failed to build news feed', details: error.message },
            { status: 500 }
        );
    }
}
