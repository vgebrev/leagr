/**
 * Momentum ("Form") metric for the Champions Hall and Ballers Board.
 *
 * Display-only signal per the momentum ADR: the divergence between a fast and a
 * slow exponential moving average of a per-session substrate, scaled by the
 * player's own variability (MAD, with a league-wide fallback), cooled on
 * calendar time and squashed to (-1, 1) with tanh.
 *
 * - Champions Hall substrate: normalised league+cup placement (combine-then-EMA,
 *   weighted by games derived from team count).
 * - Ballers Board substrate: per-session contribution aggregate
 *   (goals + offensive + defensive + save actions).
 *
 * This module is pure and deliberately separate from elo/rankings calculations.
 */

import { getEffectiveMomentumSettings } from '../shared/defaults.js';

const LN2 = Math.log(2);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EPS = 1e-9;

// Calibration gain on the EMA divergence before tanh. A fast-vs-slow divergence
// after a single shock is structurally ~0.14-0.23 of the shock size, so without
// gain even a 3-MAD comeback would read lukewarm. Calibrated against a real
// season (pirates 2026): gain 1.5 reads the ADR worked comeback (4 last places
// then a 0.875 session) at ~0.6, saturating only when the run is sustained
// (~0.85 after a second strong week), keeps steady performers near 0, and
// leaves only a few genuinely streaking players above |0.85|. Higher gains
// saturated half the active board, violating the ADR's "a single lucky draw
// shouldn't spike a player to max heat".
const MOMENTUM_GAIN = 1.5;

// League-wide k fallbacks when even the pooled MAD carries no signal
// (e.g. a brand-new league). Placement lives in [0, 1]; contributions are counts.
const PLACEMENT_FALLBACK_K = 0.25;
const CONTRIBUTION_FALLBACK_K = 1;

/** @typedef {import('../shared/types.js').MomentumSettings} MomentumSettings */
/** @typedef {import('../shared/types.js').LeagueSettings} LeagueSettings */

/**
 * @typedef {Object} SessionStats
 * @property {number|null} [goals]
 * @property {number|null} [offActions]
 * @property {number|null} [defActions]
 * @property {number|null} [saveActions]
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {string} [team]
 * @property {{leaguePosition?: number|null, cupProgress?: string|null, leagueWinner?: boolean, cupWinner?: boolean}} [performance]
 * @property {SessionStats} [stats]
 */

/** @typedef {Record<string, {history?: Record<string, HistoryEntry>}>} PlayersWithHistory */

/**
 * Resolve effective momentum config by deep-merging league settings over defaults.
 * @param {Partial<LeagueSettings>|null|undefined} leagueSettings - Effective league settings object
 * @returns {MomentumSettings}
 */
export function resolveMomentumConfig(leagueSettings) {
    return getEffectiveMomentumSettings(leagueSettings);
}

/**
 * Median of a list of numbers (average of middle pair for even length).
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median absolute deviation - robust spread estimate.
 * @param {number[]} values
 * @returns {number}
 */
export function mad(values) {
    if (values.length === 0) return 0;
    const m = median(values);
    return median(values.map((v) => Math.abs(v - m)));
}

/**
 * Normalised league placement: 1st = 1.0, last = 0.0, linear in between.
 * @param {number|null|undefined} position - 1-based league position
 * @param {number|null|undefined} teamCount
 * @returns {number|null}
 */
export function leagueNorm(position, teamCount) {
    if (position == null || teamCount == null || teamCount < 2) return null;
    return (teamCount - position) / (teamCount - 1);
}

/**
 * Bracket size implied by a stored cup round name (the round a team was
 * eliminated in), or null for unknown names.
 * @param {string} roundName
 * @returns {number|null}
 */
function cupRoundSize(roundName) {
    if (roundName === 'final') return 2;
    if (roundName === 'semi') return 4;
    if (roundName === 'quarter') return 8;
    if (roundName.startsWith('round-of-')) {
        const size = parseInt(roundName.replace('round-of-', ''), 10);
        return Number.isFinite(size) && size > 1 ? size : null;
    }
    return null;
}

/**
 * Normalised cup placement from the elimination round. Knockout brackets don't
 * yield a clean 1..N ordinal (same-round exits tie, no 3rd-place playoff), so
 * each round earlier you exit drops the norm by a constant 1/rounds step.
 * @param {string|null|undefined} cupProgress - 'winner', 'final', 'semi', 'quarter', 'round-of-N'
 * @param {number|null|undefined} teamCount
 * @returns {number|null}
 */
export function cupNorm(cupProgress, teamCount) {
    if (cupProgress == null || teamCount == null || teamCount < 2) return null;
    const rounds = Math.ceil(Math.log2(teamCount));
    let p;
    if (cupProgress === 'winner') {
        p = 0;
    } else {
        const size = cupRoundSize(cupProgress);
        if (size == null) return null;
        p = Math.log2(size);
    }
    return Math.min(1, Math.max(0, (rounds - p) / rounds));
}

/**
 * Combined league+cup placement for one session, weighted by the nominal games
 * each competition contributes at team count N (double round-robin vs knockout
 * rounds). Components without data are excluded rather than zero-filled.
 * @param {{leaguePosition?: number|null, cupProgress?: string|null}|null|undefined} performance - history entry performance block
 * @param {number|null|undefined} teamCount
 * @returns {number|null}
 */
export function sessionPlacement(performance, teamCount) {
    if (teamCount == null || teamCount < 2) return null;
    const league = leagueNorm(performance?.leaguePosition, teamCount);
    const cup = cupNorm(performance?.cupProgress, teamCount);
    if (league == null && cup == null) return null;
    const leagueGames = league != null ? 2 * (teamCount - 1) : 0;
    const cupGames = cup != null ? Math.ceil(Math.log2(teamCount)) : 0;
    const totalGames = leagueGames + cupGames;
    if (totalGames <= 0) return null;
    return (leagueGames * (league ?? 0) + cupGames * (cup ?? 0)) / totalGames;
}

/**
 * Per-session contribution aggregate from raw individual stats. Untracked stat
 * types (null) are ignored; a session with nothing tracked is no observation.
 * @param {SessionStats|null|undefined} stats - history entry stats block
 * @returns {number|null}
 */
export function contributionAggregate(stats) {
    if (!stats) return null;
    const tracked = [stats.goals, stats.offActions, stats.defActions, stats.saveActions].filter(
        (v) => typeof v === 'number'
    );
    if (tracked.length === 0) return null;
    return tracked.reduce((sum, v) => sum + v, 0);
}

/**
 * Calendar weeks between two YYYY-MM-DD dates (or Date objects).
 * @param {string|Date} from
 * @param {string|Date} to
 * @returns {number}
 */
function weeksBetween(from, to) {
    return (new Date(to).getTime() - new Date(from).getTime()) / WEEK_MS;
}

/**
 * Compute a player's momentum from their observed sessions.
 *
 * @param {Array<{date: string, value: number}>} observations - one substrate value per observed session
 * @param {object} config
 * @param {number} config.fastHalfLifeWeeks
 * @param {number} config.slowHalfLifeWeeks
 * @param {number} config.coolHalfLifeWeeks - calendar staleness half-life
 * @param {number} config.minSessions - cold-start damping threshold
 * @param {number} config.leagueK - league-wide variability fallback
 * @param {string|Date} config.now - render time for staleness
 * @returns {{value: number, sessions: number, provisional: boolean, lastSession: string, k: number, series: Array<{date: string, value: number}>}|null}
 */
export function computeMomentum(observations, config) {
    const obs = [...observations].sort((a, b) => a.date.localeCompare(b.date));
    if (obs.length === 0) return null;

    const { fastHalfLifeWeeks, slowHalfLifeWeeks, coolHalfLifeWeeks, minSessions, leagueK, now } =
        config;

    const values = obs.map((o) => o.value);
    const own = mad(values);
    let k = obs.length >= minSessions && own > EPS ? own : leagueK;
    if (!(k > EPS)) k = 0;

    /** @param {number} fast @param {number} slow @param {number} n @param {number} staleness */
    const squash = (fast, slow, n, staleness) => {
        if (k <= 0) return 0;
        const damp = Math.min(n / minSessions, 1);
        return Math.tanh((MOMENTUM_GAIN * (fast - slow) * staleness) / k) * damp;
    };

    let fast = obs[0].value;
    let slow = obs[0].value;
    const series = [{ date: obs[0].date, value: squash(fast, slow, 1, 1) }];

    for (let i = 1; i < obs.length; i++) {
        const dt = Math.max(weeksBetween(obs[i - 1].date, obs[i].date), EPS);
        const alphaFast = 1 - Math.exp((-dt * LN2) / fastHalfLifeWeeks);
        const alphaSlow = 1 - Math.exp((-dt * LN2) / slowHalfLifeWeeks);
        fast = alphaFast * obs[i].value + (1 - alphaFast) * fast;
        slow = alphaSlow * obs[i].value + (1 - alphaSlow) * slow;
        series.push({ date: obs[i].date, value: squash(fast, slow, i + 1, 1) });
    }

    const lastSession = obs[obs.length - 1].date;
    const gapWeeks = Math.max(weeksBetween(lastSession, now), 0);
    const staleness = Math.exp((-gapWeeks * LN2) / coolHalfLifeWeeks);

    return {
        value: squash(fast, slow, obs.length, staleness),
        sessions: obs.length,
        provisional: obs.length < minSessions,
        lastSession,
        k,
        series
    };
}

/**
 * Length of the current trailing streak. The predicate returns true (counts),
 * false (breaks) or null (category not observed that session - skipped, so a
 * missed/untracked session never breaks a streak).
 * @template T
 * @param {T[]} items - sessions in ascending date order
 * @param {(item: T) => boolean|null} predicate
 * @returns {number}
 */
export function currentStreak(items, predicate) {
    let count = 0;
    for (let i = items.length - 1; i >= 0; i--) {
        const result = predicate(items[i]);
        if (result === true) count++;
        else if (result === false) break;
    }
    return count;
}

/**
 * Pick which champions streak badges to display. A badge only renders when its
 * streak is >= 2 and strictly longer than every more prestigious streak that
 * implies it (double implies league, cup and silverware; league/cup imply
 * silverware). The wooden spoon is independent.
 * @param {{double: number, league: number, cup: number, silverware: number, woodenSpoon: number}} streaks
 * @returns {Array<{type: string, count: number}>}
 */
export function selectChampionsBadges(streaks) {
    const badges = [];
    if (streaks.double >= 2) badges.push({ type: 'double', count: streaks.double });
    if (streaks.league >= 2 && streaks.league > streaks.double)
        badges.push({ type: 'league', count: streaks.league });
    if (streaks.cup >= 2 && streaks.cup > streaks.double)
        badges.push({ type: 'cup', count: streaks.cup });
    if (
        streaks.silverware >= 2 &&
        streaks.silverware > streaks.double &&
        streaks.silverware > streaks.league &&
        streaks.silverware > streaks.cup
    )
        badges.push({ type: 'silverware', count: streaks.silverware });
    if (streaks.woodenSpoon >= 2) badges.push({ type: 'woodenSpoon', count: streaks.woodenSpoon });
    return badges;
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
 * Derive the team count per session date across all players. League positions
 * are unique 1..N (standings fully tie-break), so max position = N; the count
 * of distinct team names is the fallback for league-less sessions.
 * @param {PlayersWithHistory} players
 * @returns {Map<string, number>}
 */
function deriveTeamCounts(players) {
    /** @type {Map<string, {maxPos: number, teams: Set<string>}>} */
    const meta = new Map();
    for (const playerData of Object.values(players)) {
        for (const [date, entry] of Object.entries(playerData.history ?? {})) {
            let dateMeta = meta.get(date);
            if (!dateMeta) {
                dateMeta = { maxPos: 0, teams: new Set() };
                meta.set(date, dateMeta);
            }
            const pos = entry?.performance?.leaguePosition;
            if (typeof pos === 'number' && pos > dateMeta.maxPos) dateMeta.maxPos = pos;
            if (entry?.team) dateMeta.teams.add(entry.team);
        }
    }
    const counts = new Map();
    for (const [date, { maxPos, teams }] of meta) {
        counts.set(date, maxPos >= 2 ? maxPos : teams.size);
    }
    return counts;
}

/** @param {number} value */
function round4(value) {
    return Math.round(value * 10000) / 10000;
}

/**
 * @param {NonNullable<ReturnType<typeof computeMomentum>>} momentum
 * @param {string} playerName
 * @param {object} components
 * @param {Array<{type: string, count: number}>} badges
 */
function boardEntry(momentum, playerName, components, badges) {
    return {
        playerName,
        value: round4(momentum.value),
        sessions: momentum.sessions,
        provisional: momentum.provisional,
        lastSession: momentum.lastSession,
        components,
        badges,
        series: momentum.series.map((point) => ({ date: point.date, value: round4(point.value) }))
    };
}

/**
 * Build the Champions Hall (placement) momentum board.
 * @param {PlayersWithHistory} players - rankings players with history
 * @param {import('../shared/types.js').MomentumBoardConfig} config - champions momentum config
 * @param {string|Date} now - render time
 * @returns {Array<object>} board entries sorted hottest first
 */
export function buildChampionsMomentum(players, config, now) {
    const teamCounts = deriveTeamCounts(players);

    const perPlayer = Object.entries(players).map(([playerName, playerData]) => {
        const sessions = sortedHistory(playerData.history);
        const observations = /** @type {Array<{date: string, value: number}>} */ (
            sessions
                .map(({ date, entry }) => ({
                    date,
                    value: sessionPlacement(entry.performance, teamCounts.get(date))
                }))
                .filter((o) => o.value != null)
        );
        return { playerName, sessions, observations };
    });

    const pooled = perPlayer.flatMap((p) => p.observations.map((o) => o.value));
    let leagueK = mad(pooled);
    if (!(leagueK > EPS)) leagueK = PLACEMENT_FALLBACK_K;

    const board = [];
    for (const { playerName, sessions, observations } of perPlayer) {
        if (observations.length === 0) continue;
        const momentum = /** @type {NonNullable<ReturnType<typeof computeMomentum>>} */ (
            computeMomentum(observations, { ...config, leagueK, now })
        );

        const streaks = {
            double: currentStreak(sessions, ({ entry }) => {
                const perf = entry.performance ?? {};
                const leagueObserved = perf.leaguePosition != null || perf.leagueWinner;
                const cupRan = perf.cupProgress != null || perf.cupWinner;
                if (!leagueObserved || !cupRan) return null;
                return !!(perf.leagueWinner && perf.cupWinner);
            }),
            league: currentStreak(sessions, ({ entry }) => {
                const perf = entry.performance ?? {};
                if (perf.leaguePosition == null && !perf.leagueWinner) return null;
                return !!perf.leagueWinner;
            }),
            cup: currentStreak(sessions, ({ entry }) => {
                const perf = entry.performance ?? {};
                if (perf.cupProgress == null && !perf.cupWinner) return null;
                return !!perf.cupWinner;
            }),
            silverware: currentStreak(sessions, ({ entry }) => {
                const perf = entry.performance ?? {};
                const leagueObserved = perf.leaguePosition != null || perf.leagueWinner;
                const cupRan = perf.cupProgress != null || perf.cupWinner;
                if (!leagueObserved && !cupRan) return null;
                return !!(perf.leagueWinner || perf.cupWinner);
            }),
            woodenSpoon: currentStreak(sessions, ({ date, entry }) => {
                const pos = entry.performance?.leaguePosition;
                const teamCount = teamCounts.get(date);
                if (pos == null || teamCount == null || teamCount < 2) return null;
                return pos === teamCount;
            })
        };

        // Painted bar split: the games-derived league:cup weight of the player's
        // latest observed session. Presentational only.
        // observations is non-empty, so a qualifying session always exists
        const last = /** @type {{date: string, entry: HistoryEntry}} */ (
            sessions.findLast(
                ({ date, entry }) =>
                    sessionPlacement(entry.performance, teamCounts.get(date)) != null
            )
        );
        const teamCount = /** @type {number} */ (teamCounts.get(last.date));
        const hasLeague = leagueNorm(last.entry.performance?.leaguePosition, teamCount) != null;
        const hasCup = cupNorm(last.entry.performance?.cupProgress, teamCount) != null;
        const leagueGames = hasLeague ? 2 * (teamCount - 1) : 0;
        const cupGames = hasCup ? Math.ceil(Math.log2(teamCount)) : 0;
        const components = {
            league: round4(leagueGames / (leagueGames + cupGames)),
            cup: round4(cupGames / (leagueGames + cupGames))
        };

        board.push(boardEntry(momentum, playerName, components, selectChampionsBadges(streaks)));
    }

    return board.sort((a, b) => b.value - a.value);
}

const BALLER_CATEGORIES = [
    {
        type: 'mvp',
        valueOf: (/** @type {SessionStats|undefined} */ stats) => contributionAggregate(stats)
    },
    {
        type: 'goldenBoot',
        valueOf: (/** @type {SessionStats|undefined} */ stats) => stats?.goals ?? null
    },
    {
        type: 'playmaker',
        valueOf: (/** @type {SessionStats|undefined} */ stats) => stats?.offActions ?? null
    },
    {
        type: 'brickWall',
        valueOf: (/** @type {SessionStats|undefined} */ stats) => stats?.defActions ?? null
    },
    {
        type: 'goldenGlove',
        valueOf: (/** @type {SessionStats|undefined} */ stats) => stats?.saveActions ?? null
    }
];

/**
 * Build the Ballers Board (contribution) momentum board.
 * @param {PlayersWithHistory} players - rankings players with history
 * @param {import('../shared/types.js').MomentumBoardConfig} config - ballers momentum config
 * @param {string|Date} now - render time
 * @returns {Array<object>} board entries sorted hottest first
 */
export function buildBallersMomentum(players, config, now) {
    const allSessions = Object.values(players).flatMap((p) => sortedHistory(p.history));

    // Stat tracking can change mid-season (e.g. goals-only early on, full
    // contribution tracking later) - aggregates across regimes aren't
    // comparable and would read as league-wide drift, not personal form.
    // Use the stat types tracked in the latest session and only count
    // sessions that tracked all of them, summing exactly those types.
    /** @type {Map<string, Set<string>>} */
    const signatures = new Map();
    const STAT_TYPES = /** @type {(keyof SessionStats)[]} */ ([
        'goals',
        'offActions',
        'defActions',
        'saveActions'
    ]);
    for (const { date, entry } of allSessions) {
        if (!entry.stats) continue;
        let signature = signatures.get(date);
        if (!signature) {
            signature = new Set();
            signatures.set(date, signature);
        }
        for (const type of STAT_TYPES) {
            if (typeof entry.stats[type] === 'number') signature.add(type);
        }
    }
    const latestTrackedDate = [...signatures.keys()].sort().pop();
    const currentTypes = latestTrackedDate
        ? STAT_TYPES.filter((type) => signatures.get(latestTrackedDate).has(type))
        : [];

    /** @param {string} date @param {SessionStats|undefined} stats */
    const observationValue = (date, stats) => {
        if (!stats || currentTypes.length === 0) return null;
        const signature = signatures.get(date);
        if (!signature || !currentTypes.every((type) => signature.has(type))) return null;
        return currentTypes.reduce((sum, type) => sum + (stats[type] ?? 0), 0);
    };

    const perPlayer = Object.entries(players).map(([playerName, playerData]) => {
        const sessions = sortedHistory(playerData.history);
        const observations = /** @type {Array<{date: string, value: number}>} */ (
            sessions
                .map(({ date, entry }) => ({ date, value: observationValue(date, entry.stats) }))
                .filter((o) => o.value != null)
        );
        return { playerName, sessions, observations };
    });

    const pooled = perPlayer.flatMap((p) => p.observations.map((o) => o.value));
    let leagueK = mad(pooled);
    if (!(leagueK > EPS)) leagueK = CONTRIBUTION_FALLBACK_K;

    // Per-date category tops across all players (the session's award winners)
    /** @type {Map<string, Record<string, number|null>>} */
    const tops = new Map();
    for (const { sessions } of perPlayer) {
        for (const { date, entry } of sessions) {
            let dateTops = tops.get(date);
            if (!dateTops) {
                dateTops = Object.fromEntries(BALLER_CATEGORIES.map((c) => [c.type, null]));
                tops.set(date, dateTops);
            }
            for (const category of BALLER_CATEGORIES) {
                const value = category.valueOf(entry.stats);
                if (value == null) continue;
                const top = dateTops[category.type];
                if (top == null || value > top) {
                    dateTops[category.type] = value;
                }
            }
        }
    }

    const board = [];
    for (const { playerName, sessions, observations } of perPlayer) {
        if (observations.length === 0) continue;
        const momentum = /** @type {NonNullable<ReturnType<typeof computeMomentum>>} */ (
            computeMomentum(observations, { ...config, leagueK, now })
        );

        const badges = [];
        for (const category of BALLER_CATEGORIES) {
            const count = currentStreak(sessions, ({ date, entry }) => {
                const value = category.valueOf(entry.stats);
                const top = tops.get(date)?.[category.type];
                // Untracked for the player or league-wide, or a no-contribution
                // session for everyone: not an observation for this award.
                if (value == null || top == null || top <= 0) return null;
                return value === top;
            });
            if (count >= 2) badges.push({ type: category.type, count });
        }

        // Painted bar split: contribution shares over the player's recent
        // observed sessions. Presentational only.
        const recent = sessions
            .filter(({ date, entry }) => observationValue(date, entry.stats) != null)
            .slice(-config.minSessions);
        const sums = { goals: 0, attack: 0, defence: 0, saves: 0 };
        for (const { entry } of recent) {
            sums.goals += entry.stats?.goals ?? 0;
            sums.attack += entry.stats?.offActions ?? 0;
            sums.defence += entry.stats?.defActions ?? 0;
            sums.saves += entry.stats?.saveActions ?? 0;
        }
        const total = sums.goals + sums.attack + sums.defence + sums.saves;
        const components = {
            goals: total > 0 ? round4(sums.goals / total) : 0,
            attack: total > 0 ? round4(sums.attack / total) : 0,
            defence: total > 0 ? round4(sums.defence / total) : 0,
            saves: total > 0 ? round4(sums.saves / total) : 0
        };

        board.push(boardEntry(momentum, playerName, components, badges));
    }

    return board.sort((a, b) => b.value - a.value);
}
