import { describe, it, expect } from 'vitest';
import {
    DEFAULT_FANTASY_CONFIG,
    resolveFantasyConfig,
    sessionFantasyPoints,
    recencyWeightedMean,
    computeAvailability,
    priceFromExpectedPoints,
    dampPrice,
    percentileOf,
    buildPrices
} from '$lib/server/fantasyPricing.js';

const W = DEFAULT_FANTASY_CONFIG.scoring;
const ALL_TYPES = ['goals', 'offActions', 'defActions', 'saveActions'];

/** A fully tracked, attended session. */
const entry = (overrides = {}) => ({
    team: 'blue foxes',
    points: { appearance: 1, match: 6, bonus: 2, knockout: 0, total: 9, ...overrides.points },
    performance: {
        leaguePosition: 2,
        cupProgress: 'semi',
        leagueWinner: false,
        cupWinner: false,
        ...overrides.performance
    },
    stats: { goals: 1, offActions: 2, defActions: 3, saveActions: 0, ...overrides.stats },
    ratings: { elo: 1000, ...overrides.ratings },
    ranking: { rank: 5 }
});

describe('sessionFantasyPoints', () => {
    it('returns null when the player did not attend', () => {
        // Non-appearance entries carry only ratings/ranking - no points block.
        expect(sessionFantasyPoints({ ratings: { elo: 1000 } }, W)).toBeNull();
        expect(sessionFantasyPoints(null, W)).toBeNull();
    });

    it('pays for every scoring source', () => {
        const result = sessionFantasyPoints(
            entry({
                points: { appearance: 1, match: 6, knockout: 4, total: 11 },
                performance: { leagueWinner: true, cupWinner: true },
                stats: { goals: 2, offActions: 3, defActions: 4, saveActions: 5 }
            }),
            W
        );
        expect(result.breakdown).toEqual({
            appearance: W.appearance,
            goals: 2 * W.goal,
            offActions: 3 * W.offAction,
            defActions: 4 * W.defAction,
            saveActions: 5 * W.save,
            results: 6 * W.matchPoint + 4 * W.knockout,
            trophies: W.leagueWin + W.cupWin
        });
        expect(result.total).toBeCloseTo(
            Object.values(result.breakdown).reduce((s, v) => s + v, 0)
        );
    });

    it('pays only for stat types in the regime', () => {
        const goalsOnly = sessionFantasyPoints(entry(), W, ['goals']);
        expect(goalsOnly.breakdown.goals).toBe(W.goal);
        expect(goalsOnly.breakdown.offActions).toBe(0);
        expect(goalsOnly.breakdown.defActions).toBe(0);
    });

    it('treats an untracked stat as absent rather than as a zero score', () => {
        const untracked = sessionFantasyPoints(
            entry({
                stats: { goals: null, offActions: null, defActions: null, saveActions: null }
            }),
            W
        );
        // Appearance and results still pay; the stat sources simply contribute nothing.
        expect(untracked.breakdown.goals).toBe(0);
        expect(untracked.total).toBe(W.appearance + 6 * W.matchPoint);
    });
});

describe('recencyWeightedMean', () => {
    it('returns null for no observations and the value itself for one', () => {
        expect(recencyWeightedMean([], 6)).toBeNull();
        expect(recencyWeightedMean([{ date: '2026-03-07', value: 12 }], 6)).toBe(12);
    });

    it('weights recent sessions more heavily than old ones', () => {
        const rising = recencyWeightedMean(
            [
                { date: '2026-03-07', value: 0 },
                { date: '2026-06-06', value: 100 }
            ],
            6
        );
        const falling = recencyWeightedMean(
            [
                { date: '2026-03-07', value: 100 },
                { date: '2026-06-06', value: 0 }
            ],
            6
        );
        expect(rising).toBeGreaterThan(50);
        expect(falling).toBeLessThan(50);
    });

    it('discounts on calendar time, not on session count', () => {
        const near = recencyWeightedMean(
            [
                { date: '2026-06-01', value: 0 },
                { date: '2026-06-08', value: 100 }
            ],
            6
        );
        const far = recencyWeightedMean(
            [
                { date: '2026-01-01', value: 0 },
                { date: '2026-06-08', value: 100 }
            ],
            6
        );
        expect(far).toBeGreaterThan(near);
    });
});

describe('computeAvailability', () => {
    const config = DEFAULT_FANTASY_CONFIG.availability;
    const dates = ['2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27'];
    const base = { sessionDates: dates, asOf: '2026-07-04', leagueRate: 0.4, config };

    it('rates a full attender above the league rate and an absentee below it', () => {
        const ever = computeAvailability({ ...base, attendedDates: new Set(dates) });
        const never = computeAvailability({ ...base, attendedDates: new Set() });
        expect(ever.value).toBeGreaterThan(0.4);
        expect(never.value).toBeLessThan(0.4);
        expect(ever.rawRate).toBe(1);
        expect(never.rawRate).toBe(0);
    });

    it('shrinks a thin record toward the league rate', () => {
        const thin = computeAvailability({
            ...base,
            sessionDates: ['2026-06-27'],
            attendedDates: new Set(['2026-06-27'])
        });
        const thick = computeAvailability({ ...base, attendedDates: new Set(dates) });
        // Both attended everything they could; the thin record is trusted less.
        expect(thin.value).toBeLessThan(thick.value);
    });

    it('zeroes availability for a suspension - it is a certainty, not a probability', () => {
        const suspended = computeAvailability({
            ...base,
            attendedDates: new Set(dates),
            suspended: true
        });
        expect(suspended.value).toBe(0);
    });

    it('penalises active no-shows without writing the player off', () => {
        const clean = computeAvailability({ ...base, attendedDates: new Set(dates) });
        const one = computeAvailability({
            ...base,
            attendedDates: new Set(dates),
            activeNoShows: 1
        });
        const many = computeAvailability({
            ...base,
            attendedDates: new Set(dates),
            activeNoShows: 10
        });
        expect(one.value).toBeLessThan(clean.value);
        expect(many.value).toBeGreaterThanOrEqual(clean.value * config.floor - 1e-9);
    });
});

describe('priceFromExpectedPoints', () => {
    const pricing = DEFAULT_FANTASY_CONFIG.pricing;

    it('clamps to the band and rounds to the step', () => {
        expect(priceFromExpectedPoints(0, 20, pricing)).toBe(pricing.floor);
        expect(priceFromExpectedPoints(1000, 20, pricing)).toBe(pricing.ceiling);
        const mid = priceFromExpectedPoints(10, 20, pricing);
        expect(mid).toBe(8);
        expect((mid / pricing.step) % 1).toBe(0);
    });

    it('is monotone in expected points', () => {
        const low = priceFromExpectedPoints(5, 20, pricing);
        const high = priceFromExpectedPoints(15, 20, pricing);
        expect(high).toBeGreaterThan(low);
    });

    it('falls back to the floor when the pool has no signal', () => {
        expect(priceFromExpectedPoints(10, 0, pricing)).toBe(pricing.floor);
    });
});

describe('dampPrice', () => {
    it('takes the target outright on the first pricing', () => {
        expect(dampPrice(null, 9.5, 0.5, 0.5)).toBe(9.5);
    });

    it('caps a move in either direction', () => {
        expect(dampPrice(6, 12, 0.5, 0.5)).toBe(6.5);
        expect(dampPrice(6, 1, 0.5, 0.5)).toBe(5.5);
    });

    it('leaves a within-cap move alone', () => {
        expect(dampPrice(6, 6.5, 0.5, 0.5)).toBe(6.5);
        expect(dampPrice(6, 6, 0.5, 0.5)).toBe(6);
    });
});

describe('percentileOf', () => {
    it('uses nearest rank and handles the empty pool', () => {
        expect(percentileOf([], 0.5)).toBeNull();
        expect(percentileOf([1, 2, 3, 4], 0.5)).toBe(2);
        expect(percentileOf([1, 2, 3, 4], 1)).toBe(4);
        expect(percentileOf([5], 0.9)).toBe(5);
    });
});

describe('resolveFantasyConfig', () => {
    it('keeps nested defaults under a partial override', () => {
        const config = resolveFantasyConfig({ fantasy: { scoring: { goal: 10 } } });
        expect(config.scoring.goal).toBe(10);
        expect(config.scoring.save).toBe(DEFAULT_FANTASY_CONFIG.scoring.save);
        expect(config.pricing.ceiling).toBe(DEFAULT_FANTASY_CONFIG.pricing.ceiling);
    });

    it('returns the defaults when there are no league settings', () => {
        expect(resolveFantasyConfig(null)).toEqual(DEFAULT_FANTASY_CONFIG);
    });
});

/* ---------------------------------------------------------------- integration */

const PRE_REGIME = '2026-01-03';
const DATES = [
    PRE_REGIME,
    '2026-03-07',
    '2026-03-14',
    '2026-03-21',
    '2026-03-28',
    '2026-04-04',
    '2026-04-11'
];

/** Goals-only session, from before the league tracked the other three stat types. */
const preRegimeEntry = () =>
    entry({ stats: { goals: 5, offActions: null, defActions: null, saveActions: null } });

const fixture = () => ({
    players: {
        Regular: {
            elo: { rating: 1200, gamesPlayed: 100 },
            history: {
                [PRE_REGIME]: preRegimeEntry(),
                '2026-03-07': entry(),
                '2026-03-14': entry({ stats: { goals: 3 } }),
                '2026-03-21': entry(),
                '2026-03-28': entry({ stats: { goals: 2 } }),
                '2026-04-04': entry(),
                '2026-04-11': entry({ stats: { goals: 4 } })
            }
        },
        Absentee: {
            elo: { rating: 1000, gamesPlayed: 20 },
            history: {
                '2026-03-07': entry(),
                // Carried-forward ratings for the sessions they missed.
                '2026-03-14': { ratings: { elo: 1000 }, ranking: { rank: 9 } },
                '2026-03-21': { ratings: { elo: 1000 }, ranking: { rank: 9 } },
                '2026-03-28': { ratings: { elo: 1000 }, ranking: { rank: 9 } },
                '2026-04-04': { ratings: { elo: 1000 }, ranking: { rank: 9 } },
                '2026-04-11': { ratings: { elo: 1000 }, ranking: { rank: 9 } }
            }
        },
        Newcomer: {
            elo: { rating: 1050, gamesPlayed: 8 },
            history: { '2026-04-11': entry() }
        }
    },
    calculatedDates: DATES
});

describe('buildPrices', () => {
    it('excludes sessions outside the current tracking regime', () => {
        const result = buildPrices(fixture());
        expect(result.regime).toEqual(ALL_TYPES);
        // Five ranked dates, but the goals-only January session is not usable.
        expect(result.totalSessions).toBe(7);
        expect(result.usableSessions).toBe(6);
        expect(result.prices.find((p) => p.playerName === 'Regular').sessions).toBe(6);
    });

    it('prices a reliable player above an identical absentee', () => {
        const result = buildPrices(fixture());
        const regular = result.prices.find((p) => p.playerName === 'Regular');
        const absentee = result.prices.find((p) => p.playerName === 'Absentee');
        expect(regular.availability).toBeGreaterThan(absentee.availability);
        expect(regular.expectedWeeklyPoints).toBeGreaterThan(absentee.expectedWeeklyPoints);
        expect(regular.price).toBeGreaterThanOrEqual(absentee.price);
    });

    it('flags a thin sample as provisional and leans on the prior', () => {
        const result = buildPrices(fixture());
        const newcomer = result.prices.find((p) => p.playerName === 'Newcomer');
        expect(newcomer.provisional).toBe(true);
        expect(newcomer.credibility).toBeLessThan(0.5);
        const regular = result.prices.find((p) => p.playerName === 'Regular');
        expect(regular.provisional).toBe(false);
        expect(regular.credibility).toBeGreaterThan(newcomer.credibility);
    });

    it('emits one price-series point per usable session, damped', () => {
        const result = buildPrices(fixture());
        const regular = result.prices.find((p) => p.playerName === 'Regular');
        expect(regular.series).toHaveLength(6);
        expect(regular.series.map((s) => s.date)).toEqual(DATES.slice(1));
        for (let i = 1; i < regular.series.length; i++) {
            const move = Math.abs(regular.series[i].price - regular.series[i - 1].price);
            expect(move).toBeLessThanOrEqual(DEFAULT_FANTASY_CONFIG.pricing.maxWeeklyMove + 1e-9);
        }
    });

    it('is deterministic - replay produces identical prices', () => {
        expect(buildPrices(fixture())).toEqual(buildPrices(fixture()));
    });

    it('zeroes a suspended player and marks them, rather than dropping the row', () => {
        const result = buildPrices({
            ...fixture(),
            availabilityOverrides: { Regular: { suspended: true } }
        });
        const regular = result.prices.find((p) => p.playerName === 'Regular');
        expect(regular.suspended).toBe(true);
        expect(regular.availability).toBe(0);
        expect(regular.expectedWeeklyPoints).toBe(0);
    });

    it('breaks a price down into sources that sum to the expected points', () => {
        const result = buildPrices(fixture());
        const regular = result.prices.find((p) => p.playerName === 'Regular');
        const summed = Object.values(regular.breakdown).reduce((s, v) => s + v, 0);
        expect(summed).toBeCloseTo(regular.observedMean, 6);
    });

    it('returns an empty market when no session is in a tracking regime', () => {
        const result = buildPrices({
            players: { Solo: { elo: { rating: 1000 }, history: {} } },
            calculatedDates: []
        });
        expect(result.prices).toEqual([]);
        expect(result.asOf).toBeNull();
    });
});
