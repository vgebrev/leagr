import { describe, it, expect } from 'vitest';
import {
    mad,
    leagueNorm,
    cupNorm,
    sessionPlacement,
    contributionAggregate,
    computeMomentum,
    currentStreak,
    championsTrophyStreak,
    resolveMomentumConfig,
    buildChampionsMomentum,
    buildBallersMomentum
} from '$lib/server/momentum.js';

const champConfig = {
    fastHalfLifeWeeks: 3,
    slowHalfLifeWeeks: 10,
    coolHalfLifeWeeks: 3,
    minSessions: 5
};

const ballersConfig = {
    fastHalfLifeWeeks: 2,
    slowHalfLifeWeeks: 10,
    coolHalfLifeWeeks: 2,
    minSessions: 5
};

/** Five consecutive Saturdays */
const DATES = ['2026-01-03', '2026-01-10', '2026-01-17', '2026-01-24', '2026-01-31'];

/**
 * Build a champions-style history entry
 * @param {string} team
 * @param {number|null} pos - league position (1-based)
 * @param {string|null} cup - cup progress round name
 * @param {{leagueWinner?: boolean, cupWinner?: boolean}} flags
 */
function champEntry(team, pos, cup, flags = {}) {
    return {
        team,
        performance: {
            leaguePosition: pos,
            cupProgress: cup,
            leagueWinner: !!flags.leagueWinner,
            cupWinner: !!flags.cupWinner
        }
    };
}

/**
 * Build a ballers-style history entry
 * @param {string} team
 * @param {object|null} stats
 */
function ballerEntry(team, stats) {
    return {
        team,
        performance: {
            leaguePosition: null,
            cupProgress: null,
            leagueWinner: false,
            cupWinner: false
        },
        ...(stats !== undefined ? { stats } : {})
    };
}

/**
 * Zip dates and entries into a history object
 * @param {Array} entries
 */
function history(entries) {
    return Object.fromEntries(entries.map((entry, i) => [DATES[i], entry]));
}

describe('mad', () => {
    it('returns 0 for constant values', () => {
        expect(mad([1, 1, 1])).toBe(0);
    });

    it('is robust to outliers', () => {
        expect(mad([1, 2, 3, 4, 100])).toBe(1);
    });

    it('returns 0 when the majority of values are identical', () => {
        expect(mad([0, 0, 0, 0, 0.875])).toBe(0);
    });

    it('averages middle values for even-length input', () => {
        expect(mad([0, 1])).toBeCloseTo(0.5, 10);
    });

    it('returns 0 for empty input', () => {
        expect(mad([])).toBe(0);
    });
});

describe('leagueNorm', () => {
    it('maps first place to 1 and last to 0', () => {
        expect(leagueNorm(1, 4)).toBe(1);
        expect(leagueNorm(4, 4)).toBe(0);
    });

    it('grades intermediate placements linearly', () => {
        expect(leagueNorm(2, 4)).toBeCloseTo(2 / 3, 10);
        expect(leagueNorm(3, 4)).toBeCloseTo(1 / 3, 10);
    });

    it('is N-agnostic (3-team session)', () => {
        expect(leagueNorm(2, 3)).toBeCloseTo(0.5, 10);
    });

    it('returns null without a position or with a single team', () => {
        expect(leagueNorm(null, 4)).toBeNull();
        expect(leagueNorm(1, 1)).toBeNull();
    });
});

describe('cupNorm', () => {
    it('maps the 2-round (N=4) bracket: winner 1.0, final 0.5, semi 0.0', () => {
        expect(cupNorm('winner', 4)).toBe(1);
        expect(cupNorm('final', 4)).toBeCloseTo(0.5, 10);
        expect(cupNorm('semi', 4)).toBe(0);
    });

    it('maps the 3-round (N=5..8) bracket in 1/3 steps', () => {
        expect(cupNorm('winner', 5)).toBe(1);
        expect(cupNorm('final', 5)).toBeCloseTo(2 / 3, 10);
        expect(cupNorm('semi', 5)).toBeCloseTo(1 / 3, 10);
        expect(cupNorm('quarter', 5)).toBe(0);
        expect(cupNorm('quarter', 8)).toBe(0);
    });

    it('derives p from bracket size for round-of-N names', () => {
        expect(cupNorm('round-of-16', 16)).toBe(0); // 4 rounds, p=4
    });

    it('returns null when there was no cup', () => {
        expect(cupNorm(null, 4)).toBeNull();
        expect(cupNorm(undefined, 4)).toBeNull();
    });

    it('clamps to 0 for an exit deeper than the nominal bracket', () => {
        expect(cupNorm('round-of-16', 4)).toBe(0);
    });
});

describe('sessionPlacement', () => {
    it('combines league and cup with games-derived weights (ADR worked example)', () => {
        // N=4: league win (1.0) + cup runner-up (0.5) -> (6*1.0 + 2*0.5)/8 = 0.875
        const entry = champEntry('blue', 1, 'final');
        expect(sessionPlacement(entry.performance, 4)).toBeCloseTo(0.875, 10);
    });

    it('produces 0 for last place and first-round cup exit', () => {
        const entry = champEntry('blue', 4, 'semi');
        expect(sessionPlacement(entry.performance, 4)).toBe(0);
    });

    it('weights N=5 sessions 8:3', () => {
        const entry = champEntry('blue', 1, 'final');
        // (8*1.0 + 3*(2/3))/11 = 10/11
        expect(sessionPlacement(entry.performance, 5)).toBeCloseTo(10 / 11, 10);
    });

    it('falls back to league-only when no cup ran', () => {
        const entry = champEntry('blue', 2, null);
        expect(sessionPlacement(entry.performance, 4)).toBeCloseTo(2 / 3, 10);
    });

    it('falls back to cup-only when no league standings exist', () => {
        const entry = champEntry('blue', null, 'winner');
        expect(sessionPlacement(entry.performance, 4)).toBe(1);
    });

    it('returns null when neither competition has data', () => {
        const entry = champEntry('blue', null, null);
        expect(sessionPlacement(entry.performance, 4)).toBeNull();
    });
});

describe('contributionAggregate', () => {
    it('sums tracked stat types', () => {
        expect(
            contributionAggregate({ goals: 2, offActions: 3, defActions: 1, saveActions: 4 })
        ).toBe(10);
    });

    it('ignores untracked (null) stat types', () => {
        expect(
            contributionAggregate({ goals: 2, offActions: 3, defActions: null, saveActions: null })
        ).toBe(5);
    });

    it('returns null when nothing was tracked', () => {
        expect(
            contributionAggregate({
                goals: null,
                offActions: null,
                defActions: null,
                saveActions: null
            })
        ).toBeNull();
        expect(contributionAggregate(undefined)).toBeNull();
    });

    it('returns 0 (a real observation) for a tracked but blank session', () => {
        expect(
            contributionAggregate({ goals: 0, offActions: 0, defActions: null, saveActions: null })
        ).toBe(0);
    });
});

describe('computeMomentum', () => {
    /** Weekly observations from values */
    function obs(values) {
        return values.map((value, i) => ({ date: DATES[i], value }));
    }

    it('reads strongly positive for the ADR comeback (4 last places then 0.875)', () => {
        const result = computeMomentum(obs([0, 0, 0, 0, 0.875]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-31'
        });
        expect(result.value).toBeGreaterThan(0.55);
        expect(result.sessions).toBe(5);
        expect(result.provisional).toBe(false);
        expect(result.lastSession).toBe('2026-01-31');
    });

    it('saturates when the comeback is sustained (second strong week)', () => {
        const sustained = [...obs([0, 0, 0, 0, 0.875]), { date: '2026-02-07', value: 0.875 }];
        const result = computeMomentum(sustained, {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-02-07'
        });
        expect(result.value).toBeGreaterThan(0.8);
    });

    it('falls back to league k when own MAD is 0 (comeback case)', () => {
        const result = computeMomentum(obs([0, 0, 0, 0, 0.875]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-31'
        });
        expect(result.k).toBeCloseTo(0.25, 10);
    });

    it('uses own MAD once history is sufficient and varied', () => {
        const result = computeMomentum(obs([0.2, 0.4, 0.6, 0.8, 1.0]), {
            ...champConfig,
            leagueK: 0.05,
            now: '2026-01-31'
        });
        // own MAD of [0.2, 0.4, 0.6, 0.8, 1.0] = 0.2
        expect(result.k).toBeCloseTo(0.2, 10);
    });

    it('reads flat (0) for a champion who keeps winning', () => {
        const result = computeMomentum(obs([1, 1, 1, 1, 1]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-31'
        });
        expect(result.value).toBeCloseTo(0, 10);
    });

    it('reads negative for a player falling below their own baseline', () => {
        const result = computeMomentum(obs([1, 1, 1, 1, 0.125]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-31'
        });
        expect(result.value).toBeLessThan(-0.55);
    });

    it('cools toward neutral with calendar staleness', () => {
        const fresh = computeMomentum(obs([0, 0, 0, 0, 0.875]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-31'
        });
        // 3 weeks later = one cool half-life -> tanh argument halves
        const stale = computeMomentum(obs([0, 0, 0, 0, 0.875]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-02-21'
        });
        const veryStale = computeMomentum(obs([0, 0, 0, 0, 0.875]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-06-30'
        });
        expect(stale.value).toBeGreaterThan(0);
        expect(stale.value).toBeLessThan(fresh.value);
        expect(veryStale.value).toBeGreaterThanOrEqual(0);
        expect(veryStale.value).toBeLessThan(0.05);
    });

    it('damps magnitude and flags provisional below minSessions', () => {
        const result = computeMomentum(obs([0.2, 0.9]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-10'
        });
        expect(result.provisional).toBe(true);
        expect(Math.abs(result.value)).toBeLessThanOrEqual(2 / 5 + 1e-9);
        expect(result.value).toBeGreaterThan(0);
    });

    it('returns neutral for a single observation', () => {
        const result = computeMomentum(obs([0.6]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-03'
        });
        expect(result.value).toBeCloseTo(0, 10);
        expect(result.sessions).toBe(1);
        expect(result.provisional).toBe(true);
    });

    it('returns null without observations', () => {
        expect(
            computeMomentum([], { ...champConfig, leagueK: 0.25, now: '2026-01-31' })
        ).toBeNull();
    });

    it('returns neutral when no variability scale is available at all', () => {
        const result = computeMomentum(obs([0.5, 0.5, 0.5, 0.5, 0.9]), {
            ...champConfig,
            leagueK: 0,
            now: '2026-01-31'
        });
        expect(result.value).toBe(0);
    });

    it('produces a per-session series whose final point matches the fresh value', () => {
        const result = computeMomentum(obs([0, 0, 0, 0, 0.875]), {
            ...champConfig,
            leagueK: 0.25,
            now: '2026-01-31' // same day as last session -> staleness 1
        });
        expect(result.series).toHaveLength(5);
        expect(result.series[4].date).toBe('2026-01-31');
        expect(result.series[4].value).toBeCloseTo(result.value, 10);
        expect(result.series[0].value).toBeCloseTo(0, 10);
    });
});

describe('currentStreak', () => {
    const identity = (/** @type {boolean|null} */ v) => v;

    it('counts consecutive trailing true observations', () => {
        expect(currentStreak([true, true, false, true, true], identity)).toBe(2);
        expect(currentStreak([true, true, true], identity)).toBe(3);
    });

    it('breaks on a failing observed session', () => {
        expect(currentStreak([true, true, false], identity)).toBe(0);
    });

    it('skips unobserved (null) sessions without breaking', () => {
        expect(currentStreak([true, false, null, true, null, true], identity)).toBe(2);
    });

    it('returns 0 for empty input', () => {
        expect(currentStreak([], identity)).toBe(0);
    });
});

describe('championsTrophyStreak', () => {
    /** @param {Array} entries */
    const sessions = (entries) =>
        Object.entries(history(entries)).map(([date, entry]) => ({ date, entry }));

    it('captures the actual mixed run, latest last', () => {
        // Chris: league, league, cup, league
        const streak = championsTrophyStreak(
            sessions([
                champEntry('blue', 1, null, { leagueWinner: true }),
                champEntry('blue', 1, null, { leagueWinner: true }),
                champEntry('blue', 2, 'winner', { cupWinner: true }),
                champEntry('blue', 1, null, { leagueWinner: true })
            ])
        );
        expect(streak).toEqual([
            { league: true, cup: false },
            { league: true, cup: false },
            { league: false, cup: true },
            { league: true, cup: false }
        ]);
    });

    it('flags double-winning sessions on both axes', () => {
        const streak = championsTrophyStreak(
            sessions([
                champEntry('blue', 1, 'winner', { leagueWinner: true, cupWinner: true }),
                champEntry('blue', 1, 'winner', { leagueWinner: true, cupWinner: true })
            ])
        );
        expect(streak).toEqual([
            { league: true, cup: true },
            { league: true, cup: true }
        ]);
    });

    it('breaks the run on an observed no-win session', () => {
        const streak = championsTrophyStreak(
            sessions([
                champEntry('blue', 1, null, { leagueWinner: true }),
                champEntry('blue', 3, null),
                champEntry('blue', 1, null, { leagueWinner: true })
            ])
        );
        expect(streak).toEqual([{ league: true, cup: false }]);
    });

    it('skips no-competition sessions without breaking the run', () => {
        const streak = championsTrophyStreak(
            sessions([
                champEntry('blue', 1, null, { leagueWinner: true }),
                champEntry('blue', null, null),
                champEntry('blue', 1, null, { leagueWinner: true })
            ])
        );
        expect(streak).toEqual([
            { league: true, cup: false },
            { league: true, cup: false }
        ]);
    });
});

describe('resolveMomentumConfig', () => {
    it('returns defaults when the league has no momentum settings', () => {
        const config = resolveMomentumConfig({});
        expect(config.enabled).toBe(true);
        expect(config.champions.fastHalfLifeWeeks).toBeGreaterThan(
            config.ballers.fastHalfLifeWeeks - 1e-9
        );
        expect(config.ballers.minSessions).toBeGreaterThanOrEqual(4);
    });

    it('deep-merges partial overrides', () => {
        const config = resolveMomentumConfig({
            momentum: { enabled: false, ballers: { fastHalfLifeWeeks: 4 } }
        });
        expect(config.enabled).toBe(false);
        expect(config.ballers.fastHalfLifeWeeks).toBe(4);
        expect(config.ballers.slowHalfLifeWeeks).toBe(10);
        expect(config.champions.fastHalfLifeWeeks).toBe(3);
    });
});

describe('buildChampionsMomentum', () => {
    // 4 teams, 5 weekly sessions, league only (no cup).
    // Weeks 1-4: D first, B second, C third, A last. Week 5: A first, D last.
    function leagueOnlyPlayers() {
        const positions = {
            A: [4, 4, 4, 4, 1],
            B: [2, 2, 2, 2, 2],
            C: [3, 3, 3, 3, 3],
            D: [1, 1, 1, 1, 4]
        };
        const teams = { A: 'blue', B: 'white', C: 'orange', D: 'green' };
        return Object.fromEntries(
            Object.entries(positions).map(([name, posList]) => [
                name,
                {
                    history: history(
                        posList.map((pos) =>
                            champEntry(teams[name], pos, null, { leagueWinner: pos === 1 })
                        )
                    )
                }
            ])
        );
    }

    it('puts the comeback player on top, hot, and the fallen champion cold', () => {
        const board = buildChampionsMomentum(leagueOnlyPlayers(), champConfig, '2026-01-31');
        expect(board.map((p) => p.playerName)[0]).toBe('A');
        const byName = Object.fromEntries(board.map((p) => [p.playerName, p]));
        expect(byName.A.value).toBeGreaterThan(0.5);
        expect(byName.D.value).toBeLessThan(-0.5);
        expect(byName.B.value).toBeCloseTo(0, 5);
        expect(byName.C.value).toBeCloseTo(0, 5);
        expect(board[board.length - 1].playerName).toBe('D');
    });

    it('derives team count from placements (no totalTeams field anywhere)', () => {
        const board = buildChampionsMomentum(leagueOnlyPlayers(), champConfig, '2026-01-31');
        // If N were mis-derived, B's constant 2nd of 4 would not be a constant substrate
        const byName = Object.fromEntries(board.map((p) => [p.playerName, p]));
        expect(byName.B.value).toBeCloseTo(0, 5);
    });

    it('reports sessions, series and league-only painted components', () => {
        const board = buildChampionsMomentum(leagueOnlyPlayers(), champConfig, '2026-01-31');
        const a = board.find((p) => p.playerName === 'A');
        expect(a.sessions).toBe(5);
        expect(a.series).toHaveLength(5);
        expect(a.components).toEqual({ league: 1, cup: 0 });
    });

    it('splits painted components by games-derived weights when a cup ran', () => {
        const players = {
            A: {
                history: history([
                    champEntry('blue', 1, 'final'),
                    champEntry('blue', 2, 'winner', { cupWinner: true })
                ])
            },
            B: {
                history: history([champEntry('white', 4, 'semi'), champEntry('white', 4, 'semi')])
            },
            C: {
                history: history([
                    champEntry('orange', 2, 'semi'),
                    champEntry('orange', 1, 'semi', { leagueWinner: true })
                ])
            },
            D: {
                history: history([
                    champEntry('green', 3, 'winner', { cupWinner: true }),
                    champEntry('green', 3, 'final')
                ])
            }
        };
        const board = buildChampionsMomentum(players, champConfig, '2026-01-10');
        const a = board.find((p) => p.playerName === 'A');
        // N=4 -> league:cup = 6:2
        expect(a.components.league).toBeCloseTo(0.75, 10);
        expect(a.components.cup).toBeCloseTo(0.25, 10);
    });

    it('emits the trophy streak pattern and wooden spoon count', () => {
        const players = {
            A: {
                // double, double -> Double x2 only
                history: history([
                    champEntry('blue', 1, 'winner', { leagueWinner: true, cupWinner: true }),
                    champEntry('blue', 1, 'winner', { leagueWinner: true, cupWinner: true })
                ])
            },
            B: {
                // last, last -> Wooden Spoon x2
                history: history([champEntry('white', 4, 'semi'), champEntry('white', 4, 'semi')])
            },
            C: {
                history: history([
                    champEntry('orange', 2, 'final'),
                    champEntry('orange', 3, 'semi')
                ])
            },
            D: {
                history: history([champEntry('green', 3, 'semi'), champEntry('green', 2, 'final')])
            }
        };
        const board = buildChampionsMomentum(players, champConfig, '2026-01-10');
        const byName = Object.fromEntries(board.map((p) => [p.playerName, p]));
        expect(byName.A.trophyStreak).toEqual([
            { league: true, cup: true },
            { league: true, cup: true }
        ]);
        expect(byName.A.woodenSpoonStreak).toBe(0);
        expect(byName.B.trophyStreak).toEqual([]);
        expect(byName.B.woodenSpoonStreak).toBe(2);
        expect(byName.C.trophyStreak).toEqual([]);
        expect(byName.C.woodenSpoonStreak).toBe(0);
    });

    it('does not break streaks on missed sessions', () => {
        const players = {
            A: {
                // wins week 1 and week 5, absent in between -> league streak 2
                history: {
                    [DATES[0]]: champEntry('blue', 1, null, { leagueWinner: true }),
                    [DATES[4]]: champEntry('blue', 1, null, { leagueWinner: true })
                }
            },
            B: {
                history: history(
                    [2, 2, 1, 1, 2].map((p) =>
                        champEntry('white', p, null, { leagueWinner: p === 1 })
                    )
                )
            },
            C: { history: history([3, 3, 2, 2, 3].map((p) => champEntry('orange', p, null))) },
            D: {
                history: history(
                    [4, 1, 3, 3, 4].map((p) =>
                        champEntry('green', p, null, { leagueWinner: p === 1 })
                    )
                )
            }
        };
        const board = buildChampionsMomentum(players, champConfig, '2026-01-31');
        const a = board.find((p) => p.playerName === 'A');
        expect(a.trophyStreak).toEqual([
            { league: true, cup: false },
            { league: true, cup: false }
        ]);
    });

    it('marks short-history players provisional', () => {
        const players = leagueOnlyPlayers();
        players.E = { history: { [DATES[4]]: champEntry('blue', 2, null) } };
        // E joins A's team slot; position uniqueness not enforced by the module
        const board = buildChampionsMomentum(players, champConfig, '2026-01-31');
        const e = board.find((p) => p.playerName === 'E');
        expect(e.provisional).toBe(true);
        expect(e.value).toBeCloseTo(0, 10);
    });

    it('excludes players with no placement observations', () => {
        const players = leagueOnlyPlayers();
        players.Ghost = { history: { [DATES[0]]: champEntry('blue', null, null) } };
        const board = buildChampionsMomentum(players, champConfig, '2026-01-31');
        expect(board.find((p) => p.playerName === 'Ghost')).toBeUndefined();
    });
});

describe('buildBallersMomentum', () => {
    function stats(goals, offActions, defActions, saveActions) {
        return { goals, offActions, defActions, saveActions };
    }

    function ballersPlayers() {
        return {
            // A: quiet for 4 weeks, then explodes; tops MVP in weeks 4 and 5
            A: {
                history: history([
                    ballerEntry('blue', stats(0, 1, 0, 0)),
                    ballerEntry('blue', stats(1, 0, 0, 0)),
                    ballerEntry('blue', stats(0, 0, 1, 0)),
                    ballerEntry('blue', stats(4, 3, 2, 0)),
                    ballerEntry('blue', stats(5, 4, 2, 0))
                ])
            },
            // B: steady high performer
            B: {
                history: history([
                    ballerEntry('white', stats(3, 2, 1, 0)),
                    ballerEntry('white', stats(2, 3, 1, 0)),
                    ballerEntry('white', stats(3, 2, 2, 0)),
                    ballerEntry('white', stats(2, 2, 1, 0)),
                    ballerEntry('white', stats(3, 2, 1, 0))
                ])
            },
            // C: keeper, tops saves every week
            C: {
                history: history([
                    ballerEntry('orange', stats(0, 0, 1, 5)),
                    ballerEntry('orange', stats(0, 0, 0, 6)),
                    ballerEntry('orange', stats(0, 0, 1, 5)),
                    ballerEntry('orange', stats(0, 0, 0, 5)),
                    ballerEntry('orange', stats(0, 0, 1, 6))
                ])
            }
        };
    }

    it('puts the surging contributor on top with MVP streak badge', () => {
        const board = buildBallersMomentum(ballersPlayers(), ballersConfig, '2026-01-31');
        expect(board[0].playerName).toBe('A');
        expect(board[0].value).toBeGreaterThan(0.5);
        expect(board[0].badges).toContainEqual({ type: 'mvp', count: 2 });
    });

    it('keeps the steady performer near neutral', () => {
        const board = buildBallersMomentum(ballersPlayers(), ballersConfig, '2026-01-31');
        const b = board.find((p) => p.playerName === 'B');
        expect(Math.abs(b.value)).toBeLessThan(0.35);
    });

    it('awards category streaks (golden glove) to the keeper', () => {
        const board = buildBallersMomentum(ballersPlayers(), ballersConfig, '2026-01-31');
        const c = board.find((p) => p.playerName === 'C');
        expect(c.badges).toContainEqual({ type: 'goldenGlove', count: 5 });
    });

    it('excludes sessions tracked under a different stat regime', () => {
        // Weeks 1-2: goals-only tracking league-wide; weeks 3-5: full tracking.
        // The goals-only era is not comparable to the current baseline and the
        // jump in tracked volume must not read as everyone heating up.
        const goalsOnly = (goals) => stats(goals, null, null, null);
        const players = {
            A: {
                history: history([
                    ballerEntry('blue', goalsOnly(1)),
                    ballerEntry('blue', goalsOnly(2)),
                    ballerEntry('blue', stats(1, 3, 2, 0)),
                    ballerEntry('blue', stats(2, 2, 2, 0)),
                    ballerEntry('blue', stats(1, 3, 2, 0))
                ])
            },
            B: {
                history: history([
                    ballerEntry('white', goalsOnly(0)),
                    ballerEntry('white', goalsOnly(1)),
                    ballerEntry('white', stats(2, 1, 3, 1)),
                    ballerEntry('white', stats(1, 2, 3, 1)),
                    ballerEntry('white', stats(2, 1, 3, 1))
                ])
            }
        };
        const board = buildBallersMomentum(players, ballersConfig, '2026-01-31');
        for (const player of board) {
            // Only the 3 full-tracking sessions count as observations
            expect(player.sessions).toBe(3);
            // Steady performers within the comparable era stay near neutral
            expect(Math.abs(player.value)).toBeLessThan(0.2);
        }
    });

    it('skips sessions without per-session stats (pre-tracking data)', () => {
        const players = ballersPlayers();
        players.A.history[DATES[0]] = ballerEntry('blue', undefined); // legacy entry, no stats
        const board = buildBallersMomentum(players, ballersConfig, '2026-01-31');
        const a = board.find((p) => p.playerName === 'A');
        expect(a.sessions).toBe(4);
    });

    it('does not break a category streak on a session where the category was untracked', () => {
        const players = ballersPlayers();
        // Week 4: saves untracked league-wide -> glove streak must survive
        for (const name of Object.keys(players)) {
            players[name].history[DATES[3]].stats.saveActions = null;
        }
        const board = buildBallersMomentum(players, ballersConfig, '2026-01-31');
        const c = board.find((p) => p.playerName === 'C');
        expect(c.badges).toContainEqual({ type: 'goldenGlove', count: 4 });
    });

    it('counts ties as wins for both players', () => {
        const players = {
            A: {
                history: history([
                    ballerEntry('blue', stats(2, 0, 0, 0)),
                    ballerEntry('blue', stats(2, 0, 0, 0))
                ])
            },
            B: {
                history: history([
                    ballerEntry('white', stats(2, 0, 0, 0)),
                    ballerEntry('white', stats(2, 0, 0, 0))
                ])
            }
        };
        const board = buildBallersMomentum(players, ballersConfig, '2026-01-10');
        for (const player of board) {
            expect(player.badges).toContainEqual({ type: 'goldenBoot', count: 2 });
        }
    });

    it('reports painted component shares that sum to 1', () => {
        const board = buildBallersMomentum(ballersPlayers(), ballersConfig, '2026-01-31');
        const a = board.find((p) => p.playerName === 'A');
        const sum =
            a.components.goals + a.components.attack + a.components.defence + a.components.saves;
        expect(sum).toBeCloseTo(1, 6);
        expect(a.components.goals).toBeGreaterThan(a.components.saves);
    });
});
