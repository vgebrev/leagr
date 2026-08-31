/**
 * Fantasy League player valuation.
 *
 * A price is not a weighted beauty contest of "goodness" signals - that would be
 * unfalsifiable and would double-count (elo already absorbs match results, and so do
 * trophies and form). A price here is denominated in *expected fantasy points*:
 *
 *     price = f( E[points | plays] x P(plays) )
 *
 * Each signal has one job rather than a weight in a soup:
 *
 *   - individual stats  -> the observed sample of E[points | plays] (the evidence)
 *   - elo               -> the prior for E[points | plays] when the sample is thin
 *   - trophies          -> enter through the scoring rules, plus the prior for low-n
 *   - attendance        -> P(plays), a multiplier and not an additive term
 *   - recency / form    -> the weighting inside the sample, not a separate term
 *
 * Pure module: no I/O, no data.js. Reads only the shapes that already exist in
 * `rankings-YYYY.json` and `discipline.json`, so every price is reproducible from
 * the session files and the whole model is backtestable.
 */

import { trackedStatRegime, STAT_TYPES } from './momentum.js';

const LN2 = Math.log(2);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EPS = 1e-9;

/**
 * Standardised prior coefficients, in pool standard deviations of points/session.
 *
 * Fitted, not guessed: `scripts/fantasy-pricing-report.mjs` regresses each player's
 * *observed* recency-weighted points/session on both z-scores over the established
 * pool (n=37, pirates 2026, 24 usable sessions) and prints the coefficients. Measured
 * 2026-08-31: elo 0.554, honours 0.048, R^2 0.334. Re-run the fit and update these
 * when the scoring weights change, the way MOMENTUM_GAIN was calibrated.
 *
 * Honours measures near zero *given elo* - last season's silverware says almost
 * nothing that this season's rating has not already said. The term is kept because it
 * is the only signal that survives a season boundary intact, but it should not be
 * mistaken for a meaningful trophy premium.
 *
 * Note the fit is partly self-referential and should be read as such: fantasy points
 * pay for match results and trophies, which is exactly what elo is computed from, so
 * corr(elo, points/session) = 0.67 here against the 0.173 the attack/control audit
 * measured for elo vs *individual* output. That inflation is acceptable because the
 * prior only carries weight when a player has too little evidence of their own - and
 * at that point "they win a lot" is the best guess available.
 */
export const PRIOR_ELO_BETA = 0.554;
export const PRIOR_HONOURS_GAMMA = 0.048;

/**
 * @typedef {Object} FantasyConfig
 * @property {Record<string, number>} scoring
 * @property {Record<string, number>} pricing
 * @property {Record<string, number>} availability
 * @property {Record<string, number>} squad
 */

/** @type {FantasyConfig} */
export const DEFAULT_FANTASY_CONFIG = {
    // Points for one player-session. Save weight is deliberately low relative to its
    // raw volume: saves are a role stat with a rotating keeper (docs/traits.md), so a
    // full shift in goal can out-count a striker's hat-trick several times over.
    scoring: {
        appearance: 2,
        goal: 4,
        offAction: 1.5,
        defAction: 1.5,
        save: 0.7,
        matchPoint: 0.5, // on points.match, already 3/1/0 per league game
        knockout: 0.5, // on points.knockout, already 4 per knockout win
        leagueWin: 5,
        cupWin: 4
    },
    pricing: {
        floor: 4.0,
        ceiling: 12.0,
        step: 0.5,
        // Anchor on the 90th percentile, not the max: one freak season on a max anchor
        // compresses everyone else, the same failure min-max normalisation has in the
        // attack/control ratings. A few players clamping at the ceiling is intended.
        anchorPercentile: 0.9,
        maxWeeklyMove: 0.5,
        halfLifeWeeks: 6, // recency weighting on points/session
        credibilityK: 5, // sessions at which own evidence outweighs the prior
        minSessions: 5 // below this a price is prior-dominated -> provisional
    },
    availability: {
        halfLifeWeeks: 8, // recency weighting on attendance
        priorStrength: 3, // empirical-Bayes pseudo-sessions toward the league rate
        noShowPenalty: 0.85, // multiplier per active (uncleared) no-show
        floor: 0.5 // ...but no-shows alone never take availability below this
    },
    squad: {
        size: 5,
        budgetMultiplier: 1.15
    }
};

/**
 * Deep-merge league overrides over the defaults. The league settings merge is
 * shallow, so a partial fantasy object would otherwise lose its nested defaults.
 * @param {Record<string, any>|null|undefined} leagueSettings
 * @returns {FantasyConfig}
 */
export function resolveFantasyConfig(leagueSettings) {
    const overrides = leagueSettings?.fantasy ?? {};
    return {
        scoring: { ...DEFAULT_FANTASY_CONFIG.scoring, ...overrides.scoring },
        pricing: { ...DEFAULT_FANTASY_CONFIG.pricing, ...overrides.pricing },
        availability: { ...DEFAULT_FANTASY_CONFIG.availability, ...overrides.availability },
        squad: { ...DEFAULT_FANTASY_CONFIG.squad, ...overrides.squad }
    };
}

/* ------------------------------------------------------------------ scoring */

/** Map from a scoring weight key to the stat type it pays for. */
const STAT_WEIGHT_KEYS = {
    goals: 'goal',
    offActions: 'offAction',
    defActions: 'defAction',
    saveActions: 'save'
};

/**
 * Fantasy points for one player-session, broken down by source.
 *
 * Only stat types in the current tracking regime are paid for, so a goals-only
 * session from before full tracking cannot be compared against a fully tracked one.
 *
 * @param {Object} entry - a `history[date]` entry from rankings-YYYY.json
 * @param {Record<string, number>} weights - config.scoring
 * @param {(keyof import('./momentum.js').SessionStats)[]} regimeTypes - stat types to pay for
 * @returns {{total: number, breakdown: Record<string, number>}|null} null when the player did not attend
 */
export function sessionFantasyPoints(entry, weights, regimeTypes = STAT_TYPES) {
    // Presence of the `points` block is the attended test (rankings redesign:
    // non-appearance entries carry only `ratings` and `ranking`).
    if (!entry?.points) return null;

    const breakdown = {
        appearance: weights.appearance,
        goals: 0,
        offActions: 0,
        defActions: 0,
        saveActions: 0,
        results: 0,
        trophies: 0
    };

    for (const type of regimeTypes) {
        const count = entry.stats?.[type];
        if (typeof count === 'number') breakdown[type] = weights[STAT_WEIGHT_KEYS[type]] * count;
    }

    breakdown.results =
        weights.matchPoint * (entry.points.match ?? 0) +
        weights.knockout * (entry.points.knockout ?? 0);

    breakdown.trophies =
        weights.leagueWin * (entry.performance?.leagueWinner ? 1 : 0) +
        weights.cupWin * (entry.performance?.cupWinner ? 1 : 0);

    const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
    return { total, breakdown };
}

/* -------------------------------------------------------------- maths bits */

/** @param {string|Date} from @param {string|Date} to */
function weeksBetween(from, to) {
    return (new Date(to).getTime() - new Date(from).getTime()) / WEEK_MS;
}

/** Recency weight of a session, halving every `halfLifeWeeks`. */
function recencyWeight(date, asOf, halfLifeWeeks) {
    const weeks = Math.max(weeksBetween(date, asOf), 0);
    return Math.pow(2, -weeks / halfLifeWeeks);
}

/** Nearest-rank percentile, matching the convention used for trait bands. */
export function percentileOf(values, fraction) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
    return sorted[Math.min(index, sorted.length - 1)];
}

function mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values) {
    if (values.length < 2) return 0;
    const m = mean(values);
    return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

/**
 * Time-aware exponential moving average - the recency-weighted mean of a series.
 * Same alpha as the momentum EMAs, so a gap in the calendar discounts correctly
 * rather than treating every observation as one step apart.
 * @param {Array<{date: string, value: number}>} observations - chronological
 * @param {number} halfLifeWeeks
 */
export function recencyWeightedMean(observations, halfLifeWeeks) {
    if (observations.length === 0) return null;
    let m = observations[0].value;
    for (let i = 1; i < observations.length; i++) {
        const dt = Math.max(weeksBetween(observations[i - 1].date, observations[i].date), EPS);
        const alpha = 1 - Math.exp((-dt * LN2) / halfLifeWeeks);
        m = alpha * observations[i].value + (1 - alpha) * m;
    }
    return m;
}

/* --------------------------------------------------------- availability */

/**
 * P(plays next session), as a recency-weighted attendance rate shrunk toward the
 * league rate (empirical Bayes). This is a *multiplier* on expected points, not a
 * term added to them: with a season-long squad a 9.0-quality player who turns up 40%
 * of weeks is worth less than a 5.0 who never misses. On pirates the median player
 * has 9 appearances out of 33, so attendance variance here dwarfs real fantasy
 * football's.
 *
 * @param {Object} params
 * @param {string[]} params.sessionDates - every session the player could have played, <= asOf
 * @param {Set<string>} params.attendedDates
 * @param {string} params.asOf
 * @param {number} params.leagueRate - pooled attendance rate, the shrinkage target
 * @param {Record<string, number>} params.config - config.availability
 * @param {number} [params.activeNoShows]
 * @param {boolean} [params.suspended]
 * @returns {{value: number, weightedSessions: number, rawRate: number}}
 */
export function computeAvailability({
    sessionDates,
    attendedDates,
    asOf,
    leagueRate,
    config,
    activeNoShows = 0,
    suspended = false
}) {
    let attendedWeight = 0;
    let totalWeight = 0;
    for (const date of sessionDates) {
        const w = recencyWeight(date, asOf, config.halfLifeWeeks);
        totalWeight += w;
        if (attendedDates.has(date)) attendedWeight += w;
    }

    const a = config.priorStrength * leagueRate;
    const b = config.priorStrength * (1 - leagueRate);
    const rawRate = totalWeight > EPS ? attendedWeight / totalWeight : leagueRate;
    let value = (attendedWeight + a) / (totalWeight + a + b);

    if (activeNoShows > 0) {
        // A no-show is evidence of unreliability beyond simple absence, but it should
        // not on its own write a player off entirely.
        const penalised = value * Math.pow(config.noShowPenalty, activeNoShows);
        value = Math.max(penalised, value * config.floor);
    }

    // A suspension is not a probability, it is a certainty: they cannot play.
    if (suspended) value = 0;

    return { value, weightedSessions: totalWeight, rawRate };
}

/* ------------------------------------------------------------ price mapping */

/**
 * Map expected weekly points onto the price band, anchored on a high percentile so
 * a single outlier cannot compress the rest of the pool.
 * @param {number} ewp
 * @param {number} anchor - the EWP that maps to the ceiling
 * @param {Record<string, number>} pricing - config.pricing
 */
export function priceFromExpectedPoints(ewp, anchor, pricing) {
    const { floor, ceiling, step } = pricing;
    const span = ceiling - floor;
    const raw = anchor > EPS ? floor + (span * ewp) / anchor : floor;
    const clamped = Math.min(Math.max(raw, floor), ceiling);
    return Math.round(clamped / step) * step;
}

/** Damp a price move so a single big session drifts the price rather than teleporting it. */
export function dampPrice(previous, target, maxMove, step) {
    if (previous == null) return target;
    const delta = Math.min(Math.abs(target - previous), maxMove) * Math.sign(target - previous);
    return Math.round((previous + delta) / step) * step;
}

/* -------------------------------------------------------------- orchestration */

/**
 * Flatten a player's history into one chronological timeline, so snapshots are a
 * slice rather than a rescan.
 * @param {Object} playerData
 * @param {string[]} allDates - every session date the league played, ascending
 * @param {{types: any[], isInRegime: (d: string) => boolean}} regime
 * @param {Record<string, number>} weights
 */
function buildTimeline(playerData, allDates, regime, weights) {
    const history = playerData.history ?? {};
    let lastElo = null;
    return allDates.map((date) => {
        const entry = history[date];
        // Ratings are carried forward into missed sessions, so elo is defined for
        // every date after a player's debut - that is what makes a leak-free
        // as-of-date snapshot possible.
        if (typeof entry?.ratings?.elo === 'number') lastElo = entry.ratings.elo;
        const scored =
            entry && regime.isInRegime(date)
                ? sessionFantasyPoints(entry, weights, regime.types)
                : null;
        return { date, elo: lastElo, attended: !!entry?.points, scored };
    });
}

/**
 * Recency-weighted mean of each fantasy-points source, on the same EMA as the total.
 * The components sum to the total mean, so a price can be explained by where the
 * points come from - "you cost 12.0 because you're expected to score 41.9 a week,
 * two thirds of it from goals".
 * @param {Array<Object>} timeline - the player's timeline slice, chronological
 * @param {number} halfLifeWeeks
 */
function meanBreakdown(timeline, halfLifeWeeks) {
    const scored = timeline.filter((t) => t.scored);
    if (scored.length === 0) return null;
    const sources = Object.keys(scored[0].scored.breakdown);
    /** @type {Record<string, number>} */
    const out = {};
    for (const source of sources) {
        out[source] =
            recencyWeightedMean(
                scored.map((t) => ({ date: t.date, value: t.scored.breakdown[source] })),
                halfLifeWeeks
            ) ?? 0;
    }
    return out;
}

/**
 * Price every player as of one date, using only data up to and including it.
 * @returns {Map<string, Object>}
 */
function priceSnapshot(timelines, asOf, honours, config, overrides) {
    const { pricing, availability, scoring } = config;

    /** @type {Map<string, Object>} */
    const draft = new Map();
    const pooledPoints = [];
    let attendedTotal = 0;
    let sessionsTotal = 0;

    for (const [playerName, timeline] of timelines) {
        const upTo = timeline.filter((t) => t.date <= asOf);
        if (upTo.length === 0) continue;

        const observations = upTo
            .filter((t) => t.scored)
            .map((t) => ({ date: t.date, value: t.scored.total }));
        const attendedDates = new Set(upTo.filter((t) => t.attended).map((t) => t.date));

        // Attendance is regime-independent - it is knowable for every session the
        // league played - so it uses the full date list, not just usable ones. It
        // starts at the player's debut, though: charging a July joiner for missing
        // January would price every newcomer as unreliable by construction.
        const debut = upTo.find((t) => t.attended)?.date ?? null;
        const sessionDates = debut ? upTo.filter((t) => t.date >= debut).map((t) => t.date) : [];

        attendedTotal += attendedDates.size;
        sessionsTotal += sessionDates.length;
        for (const o of observations) pooledPoints.push(o.value);

        draft.set(playerName, {
            playerName,
            observations,
            attendedDates,
            sessionDates,
            elo: upTo[upTo.length - 1].elo,
            emaMean: recencyWeightedMean(observations, pricing.halfLifeWeeks),
            // Per-source recency-weighted means, so the breakdown explains the price
            // rather than describing one arbitrary session.
            breakdown: meanBreakdown(upTo, pricing.halfLifeWeeks)
        });
    }

    const established = [...draft.values()].filter(
        (d) => d.observations.length >= pricing.minSessions
    );
    const poolMean = mean(pooledPoints);
    const poolSd = stdDev(established.map((d) => d.emaMean));
    const eloValues = established.map((d) => d.elo).filter((v) => typeof v === 'number');
    const eloMean = mean(eloValues);
    const eloSd = stdDev(eloValues);
    const honourValues = established.map((d) => honours[d.playerName] ?? 0);
    const honoursMean = mean(honourValues);
    const honoursSd = stdDev(honourValues);
    const leagueRate = sessionsTotal > 0 ? attendedTotal / sessionsTotal : 0.5;

    /** @type {Map<string, Object>} */
    const priced = new Map();
    for (const d of draft.values()) {
        const n = d.observations.length;

        // The prior is where elo and last season's honours earn their place: a
        // newcomer should not be priced off two sessions of noise, but nor should a
        // demonstrably strong player sit at league average.
        const eloZ = eloSd > EPS && typeof d.elo === 'number' ? (d.elo - eloMean) / eloSd : 0;
        const honoursZ =
            honoursSd > EPS ? ((honours[d.playerName] ?? 0) - honoursMean) / honoursSd : 0;
        const prior = poolMean + poolSd * (PRIOR_ELO_BETA * eloZ + PRIOR_HONOURS_GAMMA * honoursZ);

        // Buhlmann credibility: own evidence takes over as the sample grows.
        const credibility = n / (n + pricing.credibilityK);
        const mu = credibility * (d.emaMean ?? prior) + (1 - credibility) * prior;

        const override = overrides[d.playerName] ?? {};
        const availabilityResult = computeAvailability({
            sessionDates: d.sessionDates,
            attendedDates: d.attendedDates,
            asOf,
            leagueRate,
            config: availability,
            activeNoShows: override.activeNoShows ?? 0,
            suspended: override.suspended ?? false
        });

        priced.set(d.playerName, {
            playerName: d.playerName,
            expectedPointsPerSession: mu,
            expectedWeeklyPoints: mu * availabilityResult.value,
            availability: availabilityResult.value,
            attendanceRate: availabilityResult.rawRate,
            sessions: n,
            provisional: n < pricing.minSessions,
            suspended: !!override.suspended,
            elo: d.elo,
            credibility,
            prior,
            lastSession: d.observations.length
                ? d.observations[d.observations.length - 1].date
                : null,
            observedMean: d.emaMean,
            breakdown: d.breakdown,
            scoringWeights: scoring
        });
    }

    const anchor = percentileOf(
        [...priced.values()].filter((p) => !p.provisional).map((p) => p.expectedWeeklyPoints),
        pricing.anchorPercentile
    );
    for (const p of priced.values()) {
        p.targetPrice = priceFromExpectedPoints(p.expectedWeeklyPoints, anchor ?? 0, pricing);
    }
    return priced;
}

/**
 * Build the current price list plus the full price series that produced it.
 *
 * Prices are recomputed by deterministic replay from the season's first usable
 * session rather than read back from a store: it matches how `updateRankings()`
 * rebuilds rankings from session files and how momentum recomputes at render time,
 * it needs no new data file, and it yields the price history for free.
 *
 * @param {Object} params
 * @param {Record<string, Object>} params.players - rankings-YYYY.json players
 * @param {string[]} params.calculatedDates - session dates that produced rankings
 * @param {Record<string, Object>} [params.previousYearPlayers] - for the honours prior
 * @param {Record<string, {activeNoShows?: number, suspended?: boolean}>} [params.availabilityOverrides]
 * @param {FantasyConfig} [params.config]
 * @param {string} [params.asOf] - defaults to the last usable session
 */
export function buildPrices({
    players,
    calculatedDates,
    previousYearPlayers = {},
    availabilityOverrides = {},
    config = DEFAULT_FANTASY_CONFIG,
    asOf = null
}) {
    const regime = trackedStatRegime(players);
    const allDates = [...(calculatedDates ?? [])].sort();
    const usableDates = allDates.filter((d) => regime.isInRegime(d));
    const effectiveAsOf = asOf ?? usableDates[usableDates.length - 1] ?? null;

    /** @type {Map<string, Array<Object>>} */
    const timelines = new Map(
        Object.entries(players).map(([name, data]) => [
            name,
            buildTimeline(data, allDates, regime, config.scoring)
        ])
    );

    /** Last season's silverware informs the prior without re-counting this season's. */
    const honours = Object.fromEntries(
        Object.entries(previousYearPlayers).map(([name, data]) => [
            name,
            (data.leagueWins ?? 0) + (data.cupWins ?? 0)
        ])
    );

    if (!effectiveAsOf) {
        return {
            asOf: null,
            usableSessions: 0,
            regime: regime.types,
            budget: 0,
            squadSize: config.squad.size,
            prices: []
        };
    }

    // Replay forward, damping each move. Discipline is a "now" concern, so overrides
    // apply only to the final snapshot - historical prices are pure performance.
    const replayDates = usableDates.filter((d) => d <= effectiveAsOf);
    /** @type {Map<string, Array<{date: string, price: number}>>} */
    const series = new Map();
    /** @type {Map<string, Object>} */
    let latest = new Map();

    for (const date of replayDates) {
        const isFinal = date === replayDates[replayDates.length - 1];
        const snapshot = priceSnapshot(
            timelines,
            date,
            honours,
            config,
            isFinal ? availabilityOverrides : {}
        );
        for (const [name, entry] of snapshot) {
            const history = series.get(name) ?? [];
            const previous = history.length ? history[history.length - 1].price : null;
            const price = dampPrice(
                previous,
                entry.targetPrice,
                config.pricing.maxWeeklyMove,
                config.pricing.step
            );
            history.push({ date, price });
            series.set(name, history);
            entry.price = price;
            entry.previousPrice = previous;
            entry.change = previous == null ? 0 : Math.round((price - previous) * 100) / 100;
        }
        latest = snapshot;
    }

    const prices = [...latest.values()]
        .map((entry) => ({ ...entry, series: series.get(entry.playerName) ?? [] }))
        .sort((a, b) => b.price - a.price || b.expectedWeeklyPoints - a.expectedWeeklyPoints);

    const marketPrices = prices.filter((p) => !p.provisional).map((p) => p.price);
    const median = percentileOf(marketPrices, 0.5) ?? config.pricing.floor;
    const budget = Math.round(config.squad.size * median * config.squad.budgetMultiplier * 2) / 2;

    return {
        asOf: effectiveAsOf,
        usableSessions: replayDates.length,
        totalSessions: allDates.length,
        regime: regime.types,
        budget,
        squadSize: config.squad.size,
        prices
    };
}
