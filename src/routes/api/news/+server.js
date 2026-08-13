import fs from 'node:fs/promises';
import { json } from '@sveltejs/kit';
import { createRankingsManager } from '$lib/server/rankings.js';
import { getLeagueInfo, getLeagueDataPath } from '$lib/server/league.js';
import { getEffectiveLeagueSettings } from '$lib/shared/defaults.js';
import { resolveMomentumConfig } from '$lib/server/momentum.js';
import {
    buildNewsFeed,
    pageRecapDates,
    playedSessionDates,
    previewSessionDate
} from '$lib/server/newsFeed.js';
import { createStandingsManager } from '$lib/server/standings.js';
import { data } from '$lib/server/data.js';
import { dateString } from '$lib/shared/helpers.js';

// The feed is paged over recap cards; the preview card rides along on page 1.
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Session standings (points, goal difference, wins/losses) per played date.
 * The recap's team lines need data that isn't in the rankings history: the
 * goal-difference margin when the top two are level on points, and each
 * winning team's league losses (to flag an unbeaten "invincible" side).
 * Only the dates being rendered need loading.
 * @param {string[]} dates
 * @param {string} asOf
 * @param {string} leagueId
 * @returns {Promise<Record<string, Array>>}
 */
async function loadSessionStandings(dates, asOf, leagueId) {
    const standingsManager = createStandingsManager();
    /** @type {Record<string, Array>} */
    const standingsByDate = {};
    await Promise.all(
        dates
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
 *
 * Stories are derived from the whole season, but only one page of cards is
 * returned. Page 1 is the preview card plus the newest `limit` recaps; follow
 * `nextCursor` back through the season from there.
 *
 * Query params:
 *   - asOf=YYYY-MM-DD to view the feed as it stood at a past date (default: today).
 *     Echoed back so a client can pin the clock across pages.
 *   - limit=N recap cards per page (default 5, capped at 50)
 *   - before=YYYY-MM-DD to fetch recaps older than this date (the previous
 *     page's nextCursor). Pages after the first carry no preview card.
 */
export async function GET({ locals, url }) {
    try {
        const leagueId = locals.leagueId;

        if (!leagueId) {
            return json({ error: 'League ID is required' }, { status: 400 });
        }

        const asOfParam = url.searchParams.get('asOf');
        if (asOfParam && !DATE_PATTERN.test(asOfParam)) {
            return json({ error: 'asOf must be formatted YYYY-MM-DD' }, { status: 400 });
        }
        const before = url.searchParams.get('before');
        if (before && !DATE_PATTERN.test(before)) {
            return json({ error: 'before must be formatted YYYY-MM-DD' }, { status: 400 });
        }
        const today = dateString(new Date());
        const asOf = asOfParam && asOfParam <= today ? asOfParam : today;

        // Garbage clamps rather than erroring, the way asOf clamps to today
        const parsedLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
        const limit = Number.isNaN(parsedLimit)
            ? DEFAULT_LIMIT
            : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT);

        const settings = getEffectiveLeagueSettings(getLeagueInfo(leagueId));
        const config = resolveMomentumConfig(settings);
        if (!config.enabled) {
            return json({ cards: null, hasMore: false, nextCursor: null, asOf });
        }

        // The feed, like momentum, is a current-year signal
        const year = new Date(asOf).getFullYear();
        const rankings = await createRankingsManager()
            .setLeague(leagueId)
            .loadEnhancedRankings(year);

        const competitionDays = settings.competitionDays;

        // Only the first page carries the preview card, so the work behind it
        // (a directory scan plus the registration lookups) is page-1 only.
        const includePreview = !before;
        let previewDate;
        let registeredPlayers;
        if (includePreview) {
            // The preview card describes the next upcoming session. Normally
            // that's the next competition day, but a session can be scheduled
            // off-calendar (e.g. a public holiday) - if players have already
            // registered for an earlier date, that registered session is the
            // one going in. Note this played-date set is deliberately not
            // clamped to asOf: a future session that already has results isn't
            // an upcoming one.
            const playedDates = new Set(
                Object.values(rankings.players).flatMap((p) => Object.keys(p.history ?? {}))
            );
            const nextCompetition = previewSessionDate(rankings.players, { asOf, competitionDays });
            const registeredSession = await earliestRegisteredSession(leagueId, asOf, playedDates);
            previewDate =
                registeredSession && registeredSession < nextCompetition
                    ? registeredSession
                    : nextCompetition;

            // Gate the preview to the roster registered for that session
            // (available + waiting list), which lives in the daily session file.
            const registration = await data.get('players', previewDate, leagueId);
            registeredPlayers = registration
                ? [...(registration.available ?? []), ...(registration.waitingList ?? [])]
                : [];
        }

        const page = pageRecapDates(playedSessionDates(rankings.players, asOf), { before, limit });
        const standingsByDate = await loadSessionStandings(page.dates, asOf, leagueId);

        const cards = buildNewsFeed(
            rankings.players,
            { champions: config.champions, ballers: config.ballers },
            {
                asOf,
                competitionDays,
                previewDate,
                registeredPlayers,
                standingsByDate,
                recapDates: page.dates,
                includePreview
            }
        );

        return json({ cards, hasMore: page.hasMore, nextCursor: page.nextCursor, asOf });
    } catch (error) {
        console.error('Error building news feed:', error);
        return json(
            { error: 'Failed to build news feed', details: error.message },
            { status: 500 }
        );
    }
}
