/**
 * News Feed - narrative layer over the Momentum backend (news-feed ADR).
 *
 * Derives a chronological stream of per-session cards from the rankings
 * history: a Preview card for the upcoming session (open questions) and a
 * Recap card per played session (resolutions). Each card's board is the
 * "form going in" board(D): momentum over sessions strictly before D with
 * the clock pinned to D, so a card reads identically before and after the
 * session's own ranking update.
 *
 * Pure derivation - no new data is captured and the momentum maths is
 * untouched. This module only selects and scores stories.
 */

import {
    buildChampionsMomentum,
    buildBallersMomentum,
    deriveTeamCounts,
    deriveBallerTops,
    BALLER_CATEGORIES,
    currentStreak
} from './momentum.js';

/** @typedef {import('./momentum.js').HistoryEntry} HistoryEntry */
/** @typedef {Record<string, {history?: Record<string, HistoryEntry>}>} PlayersWithHistory */

/**
 * @typedef {Object} Thread
 * @property {string} type
 * @property {number} notability
 * @property {string} [player]
 * @property {number} [streak]
 * @property {string} [category]
 * @property {'extended'|'broken'|'started'|'carriedOver'} [outcome]
 * @property {number} [position]
 * @property {string} [board]
 * @property {number} [value]
 * @property {number} [swing]
 * @property {string} [team]
 * @property {string|null} [runnerUp]
 * @property {string|null} [finalist]
 * @property {number|null} [points]
 * @property {number|null} [margin]
 * @property {{winner: number, runnerUp: number}|null} [gd]
 * @property {boolean} [double]
 * @property {boolean} [invincible]
 * @property {Array<{category: string, players: string[], value: number}>} [winners]
 */

/** @typedef {{date: string, state: 'preview'|'recap', threads: Thread[]}} Card */

const DAY_MS = 24 * 60 * 60 * 1000;

// Editorial knobs (v1). Streak threads score on run length with outcome
// multipliers; momentum threads score on magnitude. The sub-2 momentum
// range keeps a long broken run above a routine hot-streak mention.
const MAX_THREADS = 12;
const STREAK_MIN = 2;
// A 2-run ending is churn, not news - only runs of 3+ get an obituary.
const BROKEN_MIN = 3;
// Baller-award streaks weigh heaviest: one winner per category per session
// (individual merit), where a trophy/spoon run is shared by a whole team of
// ~6 off one draw. A rare 2-session Golden Glove run should outrank the
// fortnightly crowd of shared trophy 2-runs.
const STREAK_WEIGHTS = { trophyStreak: 1.2, spoonStreak: 1.2, ballerStreak: 1.5 };
const OUTCOME_MULTIPLIERS = { extended: 1, broken: 1.6, started: 1.3, carriedOver: 0.45 };
// Team result lines are the day's basic scorelines: always on the recap
// card (reserved slots) but ranked below long streak stories - a 5-session
// trophy run (3.99) or 7 straight Golden Boots (3.81) outranks even a
// double (2.9/2.8).
const TEAM_NOTABILITY = { league: 2, cup: 1.9, leagueOfDouble: 2.9, cupOfDouble: 2.8 };
// The session's category winners as one line. A reserved-slot recap fixture
// (always shown, like the team scorelines); the score just orders it, sitting
// just under the team result.
const STARS_NOTABILITY = 1.95;
// Momentum thresholds, calibrated against the same champ-config reality as
// the momentum gain: one strong week from deep cold moves the squashed
// value by ~0.1-0.2, so "comeback" and "mover" trigger well below the
// "red hot" level a sustained run reaches.
const HOT_VALUE = 0.6;
const COMEBACK_VALUE = -0.15;
const COMEBACK_SWING = 0.1;
const MOVER_MIN_SWING = 0.08;

/** @param {number} value */
function round4(value) {
    return Math.round(value * 10000) / 10000;
}

/** @param {string} dateString @param {number} days */
function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00Z`);
    return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** @param {string} dateString */
function weekdayOf(dateString) {
    return new Date(`${dateString}T00:00:00Z`).getUTCDay();
}

/**
 * The next upcoming session date: the first date >= asOf whose weekday is a
 * competition day and that hasn't been played yet. Without usable
 * competition days, fall back to a week after the latest played date (or a
 * week after asOf on a blank slate).
 * @param {string} asOf - YYYY-MM-DD viewing clock
 * @param {number[]|null|undefined} competitionDays - weekday numbers (0=Sunday)
 * @param {Set<string>} playedDates - session dates with results
 * @returns {string}
 */
export function nextCompetitionDate(asOf, competitionDays, playedDates) {
    if (Array.isArray(competitionDays) && competitionDays.length > 0) {
        for (let i = 0; i <= 28; i++) {
            const candidate = addDays(asOf, i);
            if (competitionDays.includes(weekdayOf(candidate)) && !playedDates.has(candidate)) {
                return candidate;
            }
        }
    }
    const latest = [...playedDates].sort().pop();
    const afterLatest = latest ? addDays(latest, 7) : null;
    return afterLatest && afterLatest > asOf ? afterLatest : addDays(asOf, 7);
}

/**
 * Session dates with results at or before the viewing clock.
 * @param {PlayersWithHistory} players
 * @param {string} asOf
 * @returns {Set<string>}
 */
function collectPlayedDates(players, asOf) {
    const playedDates = new Set();
    for (const data of Object.values(players)) {
        for (const date of Object.keys(data.history ?? {})) {
            if (date <= asOf) playedDates.add(date);
        }
    }
    return playedDates;
}

/**
 * The dates a feed at this clock has recap cards for, newest first. Exported so
 * a caller can page the feed without building every card.
 * @param {PlayersWithHistory} players
 * @param {string} asOf
 * @returns {string[]}
 */
export function playedSessionDates(players, asOf) {
    return [...collectPlayedDates(players, asOf)].sort((a, b) => b.localeCompare(a));
}

/**
 * One page of recap dates. The cursor is a date rather than an offset because
 * the only thing that changes between two page requests is a new session
 * landing at the head - an offset would then re-serve a card the client
 * already has.
 * @param {string[]} datesDesc - recap dates, newest first
 * @param {{before?: string|null, limit: number}} options - before: exclusive date cursor
 * @returns {{dates: string[], hasMore: boolean, nextCursor: string|null}}
 */
export function pageRecapDates(datesDesc, { before, limit }) {
    const start = before ? datesDesc.findIndex((date) => date < before) : 0;
    if (start === -1) return { dates: [], hasMore: false, nextCursor: null };
    const dates = datesDesc.slice(start, start + limit);
    const hasMore = datesDesc.length > start + limit;
    return { dates, hasMore, nextCursor: hasMore ? dates[dates.length - 1] : null };
}

/**
 * The upcoming session date the preview card will describe. Exported so a
 * caller can load that session's registration roster (which lives outside
 * the rankings history) before building the feed.
 * @param {PlayersWithHistory} players
 * @param {{asOf: string, competitionDays?: number[]}} options
 * @returns {string}
 */
export function previewSessionDate(players, { asOf, competitionDays = [] }) {
    return nextCompetitionDate(asOf, competitionDays, collectPlayedDates(players, asOf));
}

/**
 * A player's history as [{date, entry}] in ascending date order.
 * @param {Record<string, HistoryEntry>|undefined} history
 */
function sortedHistory(history) {
    return Object.entries(history ?? {})
        .map(([date, entry]) => ({ date, entry }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Players with histories restricted to sessions strictly before a date -
 * the board(D) bound.
 * @param {PlayersWithHistory} players
 * @param {string} before
 * @returns {PlayersWithHistory}
 */
function boundHistories(players, before) {
    /** @type {PlayersWithHistory} */
    const bounded = {};
    for (const [name, data] of Object.entries(players)) {
        /** @type {Record<string, HistoryEntry>} */
        const filtered = {};
        for (const [date, entry] of Object.entries(data.history ?? {})) {
            if (date < before) filtered[date] = entry;
        }
        bounded[name] = { history: filtered };
    }
    return bounded;
}

/**
 * Did the player feature in the session on this date? The rankings history has
 * an entry for every ranked player every session - the non-appearance one is a
 * rank/decay snapshot (see rankings.js) - so the entry's presence is not
 * attendance. The appearance-only team/performance blocks are.
 * @param {PlayersWithHistory} players
 * @param {string|undefined} name
 * @param {string|null} date
 * @returns {boolean}
 */
function attended(players, name, date) {
    const entry = name == null || date == null ? null : players[name]?.history?.[date];
    return entry != null && (entry.team != null || entry.performance != null);
}

/**
 * @param {string} type - streak thread type
 * @param {number} length - run length the story is about
 * @param {Thread['outcome']} [outcome]
 */
function streakNotability(type, length, outcome) {
    const base = STREAK_WEIGHTS[type] * (1 + Math.log2(length));
    return round4(outcome ? base * OUTCOME_MULTIPLIERS[outcome] : base);
}

/**
 * Resolve a streak thread from its going-in length and the session-day
 * predicate result (true = counts, false = breaks, null = not observed, so
 * the run carries over). Returns null when the story isn't notable.
 * @param {string} type
 * @param {string} player
 * @param {number} goingIn - streak length over sessions strictly before D
 * @param {boolean|null} result - the streak predicate applied to session D
 * @param {'preview'|'recap'} state
 * @returns {Thread|null}
 */
function resolveStreakThread(type, player, goingIn, result, state) {
    if (state === 'preview') {
        if (goingIn < STREAK_MIN) return null;
        return { type, player, streak: goingIn, notability: streakNotability(type, goingIn) };
    }
    if (result === true) {
        const length = goingIn + 1;
        if (length < STREAK_MIN) return null;
        const outcome = goingIn >= STREAK_MIN ? 'extended' : 'started';
        return {
            type,
            player,
            streak: length,
            outcome,
            notability: streakNotability(type, length, outcome)
        };
    }
    if (goingIn < STREAK_MIN) return null;
    const outcome = result === false ? 'broken' : 'carriedOver';
    if (outcome === 'broken' && goingIn < BROKEN_MIN) return null;
    return {
        type,
        player,
        streak: goingIn,
        outcome,
        notability: streakNotability(type, goingIn, outcome)
    };
}

/** @param {{series?: Array<{value: number}>}} entry */
function lastSwing(entry) {
    const series = entry.series ?? [];
    if (series.length < 2) return null;
    return round4(series[series.length - 1].value - series[series.length - 2].value);
}

/**
 * Momentum threads for a preview card: red hot, comeback brewing, and the
 * biggest mover/faller, across both boards, at most one thread per player.
 * @param {Array<{playerName: string, value: number, provisional: boolean}>} champBoard
 * @param {Array<{playerName: string, value: number, provisional: boolean}>} ballersBoard
 * @returns {Thread[]}
 */
function momentumThreads(champBoard, ballersBoard) {
    /** @type {Thread[]} */
    const candidates = [];
    /** @type {{thread: Thread, swing: number}|null} */
    let mover = null;
    /** @type {{thread: Thread, swing: number}|null} */
    let faller = null;

    for (const [board, entries] of [
        ['champions', champBoard],
        ['ballers', ballersBoard]
    ]) {
        for (const entry of entries) {
            if (entry.provisional) continue;
            const swing = lastSwing(entry);
            const common = { player: entry.playerName, board, value: entry.value };
            if (entry.value >= HOT_VALUE) {
                candidates.push({
                    type: 'redHot',
                    ...common,
                    notability: round4(1.2 + entry.value)
                });
            } else if (entry.value <= COMEBACK_VALUE && swing != null && swing >= COMEBACK_SWING) {
                candidates.push({
                    type: 'comeback',
                    ...common,
                    swing,
                    notability: round4(1.5 + swing)
                });
            }
            if (swing == null) continue;
            if (swing >= MOVER_MIN_SWING && (!mover || swing > mover.swing)) {
                mover = {
                    swing,
                    thread: {
                        type: 'biggestMover',
                        ...common,
                        swing,
                        notability: round4(1 + swing)
                    }
                };
            }
            if (swing <= -MOVER_MIN_SWING && (!faller || swing < faller.swing)) {
                faller = {
                    swing,
                    thread: {
                        type: 'biggestFaller',
                        ...common,
                        swing,
                        notability: round4(1 + Math.abs(swing))
                    }
                };
            }
        }
    }

    if (mover) candidates.push(mover.thread);
    if (faller) candidates.push(faller.thread);

    // One story per player: keep their most notable angle
    /** @type {Map<string, Thread>} */
    const byPlayer = new Map();
    for (const thread of candidates) {
        const existing = byPlayer.get(thread.player);
        if (!existing || thread.notability > existing.notability) {
            byPlayer.set(thread.player, thread);
        }
    }
    return [...byPlayer.values()];
}

/**
 * The session's award winners: the top player(s) in each baller category on a
 * date (MVP / Golden Boot / Playmaker / Brick Wall / Golden Glove). All players
 * level at the top are listed - the session totals in the rankings history
 * can't reconstruct the raw "first to reach it" order the live Stars of the Day
 * board tie-breaks on. Categories with no positive contribution that day are
 * omitted.
 * @param {PlayersWithHistory} players
 * @param {string} date
 * @returns {Array<{category: string, players: string[], value: number}>}
 */
function starsOfTheDay(players, date) {
    const winners = [];
    for (const category of BALLER_CATEGORIES) {
        let bestValue = 0;
        /** @type {string[]} */
        let bestPlayers = [];
        for (const [name, data] of Object.entries(players)) {
            const value = category.valueOf(data.history?.[date]?.stats);
            if (value == null || value <= 0) continue;
            if (value > bestValue) {
                bestValue = value;
                bestPlayers = [name];
            } else if (value === bestValue) {
                bestPlayers.push(name);
            }
        }
        if (bestPlayers.length > 0) {
            bestPlayers.sort();
            winners.push({ category: category.type, players: bestPlayers, value: bestValue });
        }
    }
    return winners;
}

/**
 * A team that suffered no defeats all session: no league losses (from the
 * session standings) and no cup elimination (cupProgress absent, or 'winner').
 * Undetermined without standings, so returns false when they aren't loaded.
 * @param {string} team
 * @param {string|null|undefined} cupProgress - the team's cup exit round
 * @param {Array<{team: string, losses?: number}>|undefined} table - session standings
 * @returns {boolean}
 */
function isInvincible(team, cupProgress, table) {
    if (cupProgress != null && cupProgress !== 'winner') return false;
    const row = table?.find((t) => t.team === team);
    return row != null && row.losses === 0;
}

/**
 * Build the news feed: one preview card for the upcoming session plus a
 * recap card per played session, newest first. Threads per card are scored
 * for notability and capped.
 * @param {PlayersWithHistory} players - rankings players with history
 * @param {{champions: object, ballers: object}} config - momentum board configs
 * @param {{asOf: string, competitionDays?: number[], maxThreads?: number, registeredPlayers?: string[]|null, previewDate?: string, standingsByDate?: Record<string, Array<{team: string, goalsFor: number, goalsAgainst: number}>>, recapDates?: string[], includePreview?: boolean}} options
 *   registeredPlayers: roster signed up for the upcoming session. When an
 *   array is given, the preview card is gated to it - only those players are
 *   mentioned, and an empty roster suppresses the preview card entirely.
 *   Omit (undefined) to skip gating (show every candidate).
 *   previewDate: the upcoming session date to preview. Defaults to the next
 *   competition day, but callers can override for an off-calendar session
 *   (e.g. a public holiday) that isn't a competition day.
 *   standingsByDate: session standings keyed by date, used to report the
 *   goal-difference margin on a league title decided level on points (goal
 *   difference isn't in the rankings history). Only needed for tied dates.
 *   recapDates: build recap cards for these dates only (a page of the feed).
 *   Every other input is still derived from the full history, so a card is
 *   identical whichever page it lands on. Defaults to every played date.
 *   includePreview: set false to omit the preview card (pages after the first).
 * @returns {Card[]}
 */
export function buildNewsFeed(players, config, options) {
    const {
        asOf,
        competitionDays = [],
        maxThreads = MAX_THREADS,
        registeredPlayers,
        previewDate,
        standingsByDate,
        recapDates,
        includePreview = true
    } = options;
    const roster = Array.isArray(registeredPlayers) ? new Set(registeredPlayers) : null;

    const playedDates = collectPlayedDates(players, asOf);

    // Session date -> the session before it. Always derived from the full set
    // of played dates, so it stays correct when only a page of cards is built.
    const playedAsc = [...playedDates].sort();
    const previousPlayed = new Map(playedAsc.map((date, i) => [date, playedAsc[i - 1]]).slice(1));

    // Full-history per-date lookups for resolving session-day outcomes
    const teamCounts = deriveTeamCounts(players);
    const ballerTops = deriveBallerTops(players);
    const playerSessions = Object.entries(players).map(([playerName, data]) => ({
        playerName,
        sessions: sortedHistory(data.history)
    }));

    /**
     * @param {string} date - the card's session date D
     * @param {'preview'|'recap'} state
     * @returns {Card}
     */
    function buildCard(date, state) {
        const bounded = boundHistories(players, date);
        const champBoard = buildChampionsMomentum(bounded, config.champions, date);
        const ballersBoard = buildBallersMomentum(bounded, config.ballers, date);
        const prevDate = previousPlayed.get(date) ?? null;

        // A run staying alive is news the first session its owner misses, not
        // every session of a long absence - once they were already out last
        // time, the line is just squatting on a slot.
        /** @param {string|undefined} player */
        const inAbsenceRun = (player) =>
            state === 'recap' &&
            player != null &&
            !attended(players, player, date) &&
            prevDate != null &&
            !attended(players, player, prevDate);

        /** @type {Thread[]} */
        const threads = [];

        // Trophy and wooden-spoon streaks from the going-in champions board
        for (const entry of champBoard) {
            const perf = players[entry.playerName]?.history?.[date]?.performance;

            const trophyObserved =
                perf != null &&
                (perf.leaguePosition != null ||
                    perf.leagueWinner ||
                    perf.cupProgress != null ||
                    perf.cupWinner);
            const trophyResult = trophyObserved ? !!(perf.leagueWinner || perf.cupWinner) : null;
            const trophyThread = resolveStreakThread(
                'trophyStreak',
                entry.playerName,
                entry.trophyStreak.length,
                trophyResult,
                state
            );
            if (trophyThread) threads.push(trophyThread);

            const teamCount = teamCounts.get(date);
            const position = perf?.leaguePosition;
            const spoonResult =
                position == null || teamCount == null || teamCount < 2
                    ? null
                    : position === teamCount;
            const spoonThread = resolveStreakThread(
                'spoonStreak',
                entry.playerName,
                entry.woodenSpoonStreak,
                spoonResult,
                state
            );
            if (spoonThread) {
                if (spoonThread.outcome === 'broken') spoonThread.position = position;
                threads.push(spoonThread);
            }
        }

        // Baller award streaks per category, resolved with the same
        // predicate the badge streaks use
        for (const { playerName, sessions } of playerSessions) {
            const before = sessions.filter((s) => s.date < date);
            const atDate = players[playerName]?.history?.[date];
            for (const category of BALLER_CATEGORIES) {
                /** @param {{date: string, entry: HistoryEntry}} session */
                const predicate = ({ date: d, entry }) => {
                    const value = category.valueOf(entry.stats);
                    const top = ballerTops.get(d)?.[category.type];
                    if (value == null || top == null || top <= 0) return null;
                    return value === top;
                };
                const goingIn = currentStreak(before, predicate);
                const result = atDate ? predicate({ date, entry: atDate }) : null;
                const thread = resolveStreakThread(
                    'ballerStreak',
                    playerName,
                    goingIn,
                    result,
                    state
                );
                if (thread) {
                    thread.category = category.type;
                    threads.push(thread);
                }
            }
        }

        // Reserved-slot recap fixtures (team scorelines, stars of the day) -
        // always shown, ahead of the individual stories that compete for the
        // remaining slots.
        /** @type {Thread[]} */
        const reservedThreads = [];
        if (state === 'preview') {
            threads.push(...momentumThreads(champBoard, ballersBoard));
        } else {
            // Team result lines - the day's scorelines, derived from the
            // winners' entries. The margin is the league match-points gap
            // to the runner-up team.
            let leagueTeam = null;
            let leagueCupProgress = null;
            let winnerMatch = null;
            let runnerUpTeam = null;
            let runnerUpMatch = null;
            let cupTeam = null;
            let finalist = null;
            for (const data of Object.values(players)) {
                const entry = data.history?.[date];
                if (!entry?.team) continue;
                const perf = entry.performance ?? {};
                const match = entry.points?.match;
                if (perf.leagueWinner) {
                    if (leagueTeam == null) {
                        leagueTeam = entry.team;
                        leagueCupProgress = perf.cupProgress ?? null;
                    }
                    if (winnerMatch == null && typeof match === 'number') winnerMatch = match;
                }
                if (perf.leaguePosition === 2) {
                    runnerUpTeam ??= entry.team;
                    if (runnerUpMatch == null && typeof match === 'number') runnerUpMatch = match;
                }
                if (perf.cupWinner) cupTeam ??= entry.team;
                if (perf.cupProgress === 'final') finalist ??= entry.team;
            }
            const double = leagueTeam != null && leagueTeam === cupTeam;
            const table = standingsByDate?.[date];
            if (leagueTeam) {
                const margin =
                    winnerMatch != null && runnerUpMatch != null
                        ? winnerMatch - runnerUpMatch
                        : null;
                // Points don't separate the top two - the title was decided on
                // goal difference, which lives only in the session standings.
                let gd = null;
                if (margin === 0 && runnerUpTeam && table) {
                    const w = table.find((t) => t.team === leagueTeam);
                    const r = table.find((t) => t.team === runnerUpTeam);
                    if (w && r) {
                        gd = {
                            winner: w.goalsFor - w.goalsAgainst,
                            runnerUp: r.goalsFor - r.goalsAgainst
                        };
                    }
                }
                reservedThreads.push({
                    type: 'teamLeague',
                    team: leagueTeam,
                    runnerUp: runnerUpTeam ?? null,
                    points: winnerMatch ?? null,
                    margin,
                    gd,
                    double,
                    invincible: isInvincible(leagueTeam, leagueCupProgress, table),
                    notability: double ? TEAM_NOTABILITY.leagueOfDouble : TEAM_NOTABILITY.league
                });
            }
            if (cupTeam) {
                reservedThreads.push({
                    type: 'teamCup',
                    team: cupTeam,
                    finalist: finalist ?? null,
                    double,
                    // A cup winner never loses in the cup; invincible iff they
                    // also went unbeaten in the league.
                    invincible: isInvincible(cupTeam, 'winner', table),
                    notability: double ? TEAM_NOTABILITY.cupOfDouble : TEAM_NOTABILITY.cup
                });
            }

            // Stars of the day - one line naming each category's winner
            const winners = starsOfTheDay(players, date);
            if (winners.length > 0) {
                reservedThreads.push({
                    type: 'starsOfTheDay',
                    winners,
                    notability: STARS_NOTABILITY
                });
            }
        }

        /** @param {Thread} a @param {Thread} b */
        const byNotability = (a, b) =>
            b.notability - a.notability ||
            (a.player ?? a.team ?? '').localeCompare(b.player ?? b.team ?? '');

        // Preview cards only mention players signed up for the upcoming
        // session; recaps drop runs carried through an ongoing absence. Both
        // filter before selection, so a dropped story frees its slot.
        const storyThreads = threads.filter(
            (t) =>
                !(t.outcome === 'carriedOver' && inAbsenceRun(t.player)) &&
                (state !== 'preview' || !roster || roster.has(t.player))
        );

        // Reserved fixtures (team league, team cup, stars of the day) are
        // anchored at the top of a recap in that order; the individual stories
        // follow, ranked by notability, filling the remaining slots.
        storyThreads.sort(byNotability);
        const selected = [
            ...reservedThreads,
            ...storyThreads.slice(0, Math.max(maxThreads - reservedThreads.length, 0))
        ];
        return { date, state, threads: selected.slice(0, maxThreads) };
    }

    /** @type {Card[]} */
    const cards = [];
    // Suppress the preview when a known roster is empty (nobody signed up yet)
    if (includePreview && (roster == null || roster.size > 0)) {
        const date = previewDate ?? nextCompetitionDate(asOf, competitionDays, playedDates);
        cards.push(buildCard(date, 'preview'));
    }
    // Unknown dates are dropped and the order is imposed here, so a caller
    // can't make the feed emit a junk card or run out of sequence.
    const selectedDates = (recapDates ?? [...playedDates])
        .filter((date) => playedDates.has(date))
        .sort((a, b) => b.localeCompare(a));
    for (const date of selectedDates) {
        cards.push(buildCard(date, 'recap'));
    }
    return cards;
}
