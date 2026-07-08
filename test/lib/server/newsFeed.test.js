import { describe, it, expect } from 'vitest';
import { buildNewsFeed, nextCompetitionDate, previewSessionDate } from '$lib/server/newsFeed.js';

const config = {
    champions: {
        fastHalfLifeWeeks: 3,
        slowHalfLifeWeeks: 10,
        coolHalfLifeWeeks: 3,
        minSessions: 5
    },
    ballers: {
        fastHalfLifeWeeks: 2,
        slowHalfLifeWeeks: 10,
        coolHalfLifeWeeks: 2,
        minSessions: 5
    }
};

/** Seven consecutive Saturdays */
const DATES = [
    '2026-01-03',
    '2026-01-10',
    '2026-01-17',
    '2026-01-24',
    '2026-01-31',
    '2026-02-07',
    '2026-02-14'
];

/**
 * Build a champions-style history entry
 * @param {string} team
 * @param {number|null} pos - league position (1-based)
 * @param {string|null} cup - cup progress round name
 * @param {{leagueWinner?: boolean, cupWinner?: boolean}} flags
 * @param {{match?: number}} [points] - session points block (league match points)
 */
function champEntry(team, pos, cup, flags = {}, points) {
    return {
        team,
        ...(points ? { points } : {}),
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
 * @param {object} stats
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
        stats
    };
}

/**
 * Zip dates and entries into a history object (null entries = absent that week)
 * @param {Array} entries
 */
function history(entries) {
    return Object.fromEntries(
        entries.map((entry, i) => [DATES[i], entry]).filter(([, entry]) => entry != null)
    );
}

/**
 * 4-team league where Chris's entries vary per test and the rest shuffle placings.
 * Ben wins week 4 by default (override per test when Chris should win it).
 */
function trophyPlayers(chrisEntries) {
    return {
        Chris: { history: history(chrisEntries) },
        Ben: {
            history: history([
                champEntry('white', 2, null),
                champEntry('white', 3, null),
                champEntry('white', 2, null),
                champEntry('white', 1, null, { leagueWinner: true }),
                champEntry('white', 2, null)
            ])
        },
        Cara: {
            history: history([
                champEntry('orange', 3, null),
                champEntry('orange', 2, null),
                champEntry('orange', 3, null),
                champEntry('orange', 2, null),
                champEntry('orange', 3, null)
            ])
        },
        Dan: {
            history: history([
                champEntry('green', 4, null),
                champEntry('green', 4, null),
                champEntry('green', 4, null),
                champEntry('green', 3, null),
                champEntry('green', 4, null)
            ])
        }
    };
}

const chrisWins3 = [
    champEntry('blue', 1, null, { leagueWinner: true }),
    champEntry('blue', 1, null, { leagueWinner: true }),
    champEntry('blue', 1, null, { leagueWinner: true })
];

/** Find the card for a date */
function cardFor(cards, date) {
    return cards.find((c) => c.date === date);
}

/** Find a thread on a card */
function threadOf(card, type, player) {
    return card.threads.find((t) => t.type === type && t.player === player);
}

describe('nextCompetitionDate', () => {
    it('returns asOf itself when it is an unplayed competition day', () => {
        // 2026-02-07 is a Saturday
        expect(nextCompetitionDate('2026-02-07', [6], new Set())).toBe('2026-02-07');
    });

    it('skips an already-played competition day to the next week', () => {
        expect(nextCompetitionDate('2026-02-07', [6], new Set(['2026-02-07']))).toBe('2026-02-14');
    });

    it('scans forward to the next matching weekday', () => {
        // 2026-02-04 is a Wednesday
        expect(nextCompetitionDate('2026-02-04', [6], new Set())).toBe('2026-02-07');
    });

    it('falls back to a week after the latest played date without competition days', () => {
        expect(nextCompetitionDate('2026-02-01', [], new Set(['2026-01-24', '2026-01-31']))).toBe(
            '2026-02-07'
        );
    });

    it('falls back to a week after asOf with neither competition days nor history', () => {
        expect(nextCompetitionDate('2026-02-01', [], new Set())).toBe('2026-02-08');
    });
});

describe('previewSessionDate', () => {
    it('returns the next competition day after the played history', () => {
        const players = trophyPlayers([...chrisWins3]);
        // weeks 1-3 played (through 2026-01-17); next Saturday is 2026-01-24
        expect(previewSessionDate(players, { asOf: '2026-01-17', competitionDays: [6] })).toBe(
            '2026-01-24'
        );
    });

    it('matches the date the feed uses for its preview card', () => {
        const players = trophyPlayers([...chrisWins3]);
        const date = previewSessionDate(players, { asOf: '2026-01-17', competitionDays: [6] });
        const cards = buildNewsFeed(players, config, { asOf: '2026-01-17', competitionDays: [6] });
        expect(cards[0].date).toBe(date);
    });
});

describe('preview roster gating', () => {
    it('shows the preview card ungated when no roster is provided', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, { asOf: '2026-01-17', competitionDays: [6] });
        expect(cards[0].state).toBe('preview');
        expect(cards[0].threads.length).toBeGreaterThan(0);
    });

    it('suppresses the preview card entirely when the roster is empty', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6],
            registeredPlayers: []
        });
        expect(cards[0].state).toBe('recap');
        expect(cards.every((c) => c.state === 'recap')).toBe(true);
    });

    it('mentions only registered players on the preview card', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6],
            registeredPlayers: ['Chris']
        });
        expect(cards[0].state).toBe('preview');
        expect(cards[0].threads.length).toBeGreaterThan(0);
        expect(cards[0].threads.every((t) => t.player === 'Chris')).toBe(true);
        expect(threadOf(cards[0], 'trophyStreak', 'Chris')).toBeDefined();
    });

    it('drops an unregistered player who would otherwise have a preview story', () => {
        const players = trophyPlayers([...chrisWins3]);
        // Dan carries a 3-session wooden-spoon run going into the preview
        const ungated = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6]
        });
        expect(threadOf(ungated[0], 'spoonStreak', 'Dan')).toBeDefined();
        const gated = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6],
            registeredPlayers: ['Chris']
        });
        expect(threadOf(gated[0], 'spoonStreak', 'Dan')).toBeUndefined();
    });

    it('previews an explicit off-calendar date (e.g. a public-holiday session)', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-19', // Monday after the week-3 Saturday
            competitionDays: [6],
            previewDate: '2026-01-19', // holiday session, not a competition day
            registeredPlayers: ['Chris']
        });
        expect(cards[0].state).toBe('preview');
        expect(cards[0].date).toBe('2026-01-19');
        expect(cards[0].threads.every((t) => t.player === 'Chris')).toBe(true);
        expect(threadOf(cards[0], 'trophyStreak', 'Chris')).toBeDefined();
    });

    it('falls back to the next competition day when no previewDate is given', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-19',
            competitionDays: [6],
            registeredPlayers: ['Chris']
        });
        expect(cards[0].date).toBe('2026-01-24');
    });

    it('leaves recap cards untouched by the roster gate', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6],
            registeredPlayers: ['Chris']
        });
        const recap = cardFor(cards, '2026-01-17');
        expect(recap.state).toBe('recap');
        // Dan's spoon run is reported on the recap regardless of the upcoming roster
        expect(recap.threads.some((t) => t.player && t.player !== 'Chris')).toBe(true);
    });
});

describe('buildNewsFeed cards', () => {
    it('orders cards newest first with a leading preview card', () => {
        const players = trophyPlayers([...chrisWins3, champEntry('blue', 3, null)]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        expect(cards[0].date).toBe('2026-01-31');
        expect(cards[0].state).toBe('preview');
        expect(cards.slice(1).map((c) => c.date)).toEqual([
            '2026-01-24',
            '2026-01-17',
            '2026-01-10',
            '2026-01-03'
        ]);
        expect(cards.slice(1).every((c) => c.state === 'recap')).toBe(true);
    });

    it('excludes sessions after the as-of clock', () => {
        const players = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 3, null),
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6]
        });
        expect(cards.map((c) => c.date)).toEqual([
            '2026-01-24',
            '2026-01-17',
            '2026-01-10',
            '2026-01-03'
        ]);
    });

    it('flips the same date from preview to recap once its results are in', () => {
        const players = trophyPlayers([...chrisWins3, champEntry('blue', 3, null)]);
        const before = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6]
        });
        const after = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        expect(cardFor(before, '2026-01-24').state).toBe('preview');
        expect(cardFor(after, '2026-01-24').state).toBe('recap');
    });

    it('reads a recap card identically before and after later sessions exist (frozen board)', () => {
        const upToWeek4 = trophyPlayers([...chrisWins3, champEntry('blue', 3, null)]);
        const fullSeason = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 3, null),
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        const early = buildNewsFeed(upToWeek4, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const late = buildNewsFeed(fullSeason, config, {
            asOf: '2026-01-31',
            competitionDays: [6]
        });
        expect(cardFor(late, '2026-01-24')).toEqual(cardFor(early, '2026-01-24'));
    });

    it('emits an empty-thread preview card for a fresh season', () => {
        const cards = buildNewsFeed({}, config, { asOf: '2026-01-01', competitionDays: [6] });
        expect(cards).toHaveLength(1);
        expect(cards[0].state).toBe('preview');
        expect(cards[0].threads).toEqual([]);
    });
});

describe('trophy streak threads', () => {
    it('previews an open streak question with the going-in length', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6]
        });
        const thread = threadOf(cards[0], 'trophyStreak', 'Chris');
        expect(thread).toBeDefined();
        expect(thread.streak).toBe(3);
        expect(thread.outcome).toBeUndefined();
    });

    it('resolves an extended streak on the recap card', () => {
        const players = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = threadOf(cardFor(cards, '2026-01-24'), 'trophyStreak', 'Chris');
        expect(thread.outcome).toBe('extended');
        expect(thread.streak).toBe(4);
    });

    it('resolves a broken streak with the length of the run that ended', () => {
        const players = trophyPlayers([...chrisWins3, champEntry('blue', 3, null)]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = threadOf(cardFor(cards, '2026-01-24'), 'trophyStreak', 'Chris');
        expect(thread.outcome).toBe('broken');
        expect(thread.streak).toBe(3);
    });

    it('carries a streak over when the player sat out', () => {
        const players = trophyPlayers([...chrisWins3, null]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = threadOf(cardFor(cards, '2026-01-24'), 'trophyStreak', 'Chris');
        expect(thread.outcome).toBe('carriedOver');
        expect(thread.streak).toBe(3);
    });

    it('marks a run reaching two as started', () => {
        const players = trophyPlayers([
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        // Ben wins week 4 in the shared fixture; give it to Chris instead
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = threadOf(cardFor(cards, '2026-01-24'), 'trophyStreak', 'Chris');
        expect(thread.outcome).toBe('started');
        expect(thread.streak).toBe(2);
    });

    it('does not emit a streak thread for a single unremarkable win', () => {
        const players = trophyPlayers([
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        // Ben won week 4 with no run behind it
        const thread = threadOf(cardFor(cards, '2026-01-24'), 'trophyStreak', 'Ben');
        expect(thread).toBeUndefined();
    });
});

describe('wooden spoon streak threads', () => {
    function spoonPlayers(danEntries) {
        const players = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        players.Dan = { history: history(danEntries) };
        return players;
    }

    it('resolves a broken spoon run and reports the escape position', () => {
        const players = spoonPlayers([
            champEntry('green', 4, null),
            champEntry('green', 4, null),
            champEntry('green', 4, null),
            champEntry('green', 2, null)
        ]);
        // Someone still has to finish last in week 4
        players.Cara.history['2026-01-24'] = champEntry('orange', 4, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = threadOf(cardFor(cards, '2026-01-24'), 'spoonStreak', 'Dan');
        expect(thread.outcome).toBe('broken');
        expect(thread.streak).toBe(3);
        expect(thread.position).toBe(2);
    });

    it('extends a spoon run when the player finishes last again', () => {
        const players = spoonPlayers([
            champEntry('green', 4, null),
            champEntry('green', 4, null),
            champEntry('green', 4, null),
            champEntry('green', 4, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = threadOf(cardFor(cards, '2026-01-24'), 'spoonStreak', 'Dan');
        expect(thread.outcome).toBe('extended');
        expect(thread.streak).toBe(4);
    });

    it('previews the open escape question', () => {
        const players = spoonPlayers([
            champEntry('green', 4, null),
            champEntry('green', 4, null),
            champEntry('green', 4, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6]
        });
        const thread = threadOf(cards[0], 'spoonStreak', 'Dan');
        expect(thread.streak).toBe(3);
        expect(thread.outcome).toBeUndefined();
    });
});

describe('baller award streak threads', () => {
    const stats = (goals, offActions, defActions, saveActions) => ({
        goals,
        offActions,
        defActions,
        saveActions
    });

    function keeperPlayers(week4Saves) {
        return {
            Kat: {
                history: history([
                    ballerEntry('blue', stats(0, 0, 1, 5)),
                    ballerEntry('blue', stats(0, 0, 0, 6)),
                    ballerEntry('blue', stats(0, 0, 1, 5)),
                    ballerEntry('blue', stats(0, 0, 1, week4Saves.kat))
                ])
            },
            Leo: {
                history: history([
                    ballerEntry('white', stats(2, 1, 1, 1)),
                    ballerEntry('white', stats(1, 2, 1, 0)),
                    ballerEntry('white', stats(2, 1, 1, 1)),
                    ballerEntry('white', stats(2, 1, 1, week4Saves.leo))
                ])
            }
        };
    }

    it('resolves a broken golden glove run when someone else tops saves', () => {
        const players = keeperPlayers({ kat: 1, leo: 4 });
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            maxThreads: 10
        });
        const threads = cardFor(cards, '2026-01-24').threads.filter(
            (t) => t.type === 'ballerStreak' && t.player === 'Kat' && t.category === 'goldenGlove'
        );
        expect(threads).toHaveLength(1);
        expect(threads[0].outcome).toBe('broken');
        expect(threads[0].streak).toBe(3);
    });

    it('extends the run when the keeper tops saves again', () => {
        const players = keeperPlayers({ kat: 6, leo: 1 });
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            maxThreads: 10
        });
        const threads = cardFor(cards, '2026-01-24').threads.filter(
            (t) => t.type === 'ballerStreak' && t.player === 'Kat' && t.category === 'goldenGlove'
        );
        expect(threads).toHaveLength(1);
        expect(threads[0].outcome).toBe('extended');
        expect(threads[0].streak).toBe(4);
    });

    it('carries the run over when the category was untracked that week', () => {
        const players = keeperPlayers({ kat: 1, leo: 4 });
        players.Kat.history['2026-01-24'].stats.saveActions = null;
        players.Leo.history['2026-01-24'].stats.saveActions = null;
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            maxThreads: 10
        });
        const threads = cardFor(cards, '2026-01-24').threads.filter(
            (t) => t.type === 'ballerStreak' && t.player === 'Kat' && t.category === 'goldenGlove'
        );
        expect(threads).toHaveLength(1);
        expect(threads[0].outcome).toBe('carriedOver');
        expect(threads[0].streak).toBe(3);
    });

    it('previews the open award-run question', () => {
        const players = keeperPlayers({ kat: 5, leo: 1 });
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            maxThreads: 10
        });
        const threads = cards[0].threads.filter(
            (t) => t.type === 'ballerStreak' && t.player === 'Kat' && t.category === 'goldenGlove'
        );
        expect(threads).toHaveLength(1);
        expect(threads[0].streak).toBe(4);
        expect(threads[0].outcome).toBeUndefined();
    });
});

describe('team result threads', () => {
    it('reports the league winner, runner-up team, points total and margin', () => {
        const players = trophyPlayers([
            champEntry('blue', 1, null, { leagueWinner: true }, { match: 13 }),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        players.Ben.history['2026-01-03'] = champEntry('white', 2, null, {}, { match: 11 });
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamLeague');
        expect(thread).toBeDefined();
        expect(thread.team).toBe('blue');
        expect(thread.runnerUp).toBe('white');
        expect(thread.points).toBe(13);
        expect(thread.margin).toBe(2);
        expect(thread.gd).toBeNull();
        expect(thread.double).toBe(false);
    });

    it('reports the goal-difference margin when the top two are level on points', () => {
        const players = trophyPlayers([
            champEntry('blue', 1, null, { leagueWinner: true }, { match: 11 }),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        players.Ben.history['2026-01-03'] = champEntry('white', 2, null, {}, { match: 11 });
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            standingsByDate: {
                '2026-01-03': [
                    { team: 'blue', goalsFor: 12, goalsAgainst: 5 },
                    { team: 'white', goalsFor: 10, goalsAgainst: 6 }
                ]
            }
        });
        const thread = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamLeague');
        expect(thread.margin).toBe(0);
        expect(thread.runnerUp).toBe('white');
        expect(thread.points).toBe(11);
        expect(thread.gd).toEqual({ winner: 7, runnerUp: 4 });
    });

    it('leaves gd null on a points tie when no standings are supplied', () => {
        const players = trophyPlayers([
            champEntry('blue', 1, null, { leagueWinner: true }, { match: 11 }),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        players.Ben.history['2026-01-03'] = champEntry('white', 2, null, {}, { match: 11 });
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const thread = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamLeague');
        expect(thread.margin).toBe(0);
        expect(thread.gd).toBeNull();
    });

    it('reports the cup winners with the beaten finalist and flags the double', () => {
        const players = trophyPlayers([
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 1, 'winner', { leagueWinner: true, cupWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, 'final');
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const card = cardFor(cards, '2026-01-24');
        const league = card.threads.find((t) => t.type === 'teamLeague');
        const cup = card.threads.find((t) => t.type === 'teamCup');
        expect(league.team).toBe('blue');
        expect(league.double).toBe(true);
        expect(cup.team).toBe('blue');
        expect(cup.finalist).toBe('white');
        expect(cup.double).toBe(true);
    });

    it('flags an unbeaten league winner as invincible', () => {
        const players = trophyPlayers([
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            standingsByDate: {
                '2026-01-03': [
                    { team: 'blue', losses: 0, goalsFor: 8, goalsAgainst: 3 },
                    { team: 'white', losses: 2, goalsFor: 5, goalsAgainst: 7 }
                ]
            }
        });
        const league = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamLeague');
        expect(league.invincible).toBe(true);
    });

    it('does not flag a league winner who lost a game', () => {
        const players = trophyPlayers([
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            standingsByDate: {
                '2026-01-03': [{ team: 'blue', losses: 1, goalsFor: 8, goalsAgainst: 5 }]
            }
        });
        const league = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamLeague');
        expect(league.invincible).toBe(false);
    });

    it('does not flag a league winner eliminated in the cup as invincible', () => {
        const players = trophyPlayers([
            champEntry('blue', 1, 'final', { leagueWinner: true }), // lost the cup final
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            standingsByDate: {
                '2026-01-03': [{ team: 'blue', losses: 0, goalsFor: 8, goalsAgainst: 3 }]
            }
        });
        const league = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamLeague');
        expect(league.invincible).toBe(false);
    });

    it('flags an unbeaten cup winner as invincible', () => {
        const players = trophyPlayers([
            champEntry('blue', 2, 'winner', { cupWinner: true }),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        // Someone else wins the league so there's a distinct cup story
        players.Ben.history['2026-01-03'] = champEntry('white', 1, 'final', { leagueWinner: true });
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            standingsByDate: {
                '2026-01-03': [
                    { team: 'white', losses: 1, goalsFor: 9, goalsAgainst: 6 },
                    { team: 'blue', losses: 0, goalsFor: 7, goalsAgainst: 4 }
                ]
            }
        });
        const cup = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamCup');
        expect(cup.invincible).toBe(true);
    });

    it('leaves invincible false when standings are not supplied', () => {
        const players = trophyPlayers([
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null),
            champEntry('blue', 2, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const league = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'teamLeague');
        expect(league.invincible).toBe(false);
    });

    it('keeps the team scoreline even when winners already carry streak threads', () => {
        const players = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const card = cardFor(cards, '2026-01-24');
        expect(threadOf(card, 'trophyStreak', 'Chris')).toBeDefined();
        expect(card.threads.find((t) => t.type === 'teamLeague')?.team).toBe('blue');
    });

    it('keeps the team scoreline on a card crowded with higher-scored stories', () => {
        const players = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            maxThreads: 2
        });
        const card = cardFor(cards, '2026-01-24');
        expect(card.threads.length).toBeLessThanOrEqual(2);
        expect(card.threads.some((t) => t.type === 'teamLeague')).toBe(true);
    });

    it('never appears on preview cards', () => {
        const players = trophyPlayers([...chrisWins3]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-17',
            competitionDays: [6]
        });
        expect(cards[0].threads.every((t) => t.type !== 'teamLeague' && t.type !== 'teamCup')).toBe(
            true
        );
    });
});

describe('stars of the day', () => {
    const stats = (goals, offActions, defActions, saveActions) => ({
        goals,
        offActions,
        defActions,
        saveActions
    });

    function ballersPlayers() {
        return {
            // Jay: top contribution (MVP) and top scorer (Golden Boot)
            Jay: { history: history([ballerEntry('blue', stats(4, 2, 1, 0))]) },
            // Kat: keeper, top saves (Golden Glove)
            Kat: { history: history([ballerEntry('white', stats(0, 0, 1, 6))]) },
            // Vic: top defender (Brick Wall) and playmaker (offActions)
            Vic: { history: history([ballerEntry('orange', stats(1, 5, 4, 0))]) }
        };
    }

    it('emits a single item naming the winner in each contested category', () => {
        const cards = buildNewsFeed(ballersPlayers(), config, {
            asOf: '2026-01-03',
            competitionDays: [6]
        });
        const stars = cardFor(cards, '2026-01-03').threads.filter(
            (t) => t.type === 'starsOfTheDay'
        );
        expect(stars).toHaveLength(1);
        const byCategory = Object.fromEntries(stars[0].winners.map((w) => [w.category, w.players]));
        expect(byCategory).toEqual({
            mvp: ['Vic'], // 1+5+4 = 10 beats Jay's 4+2+1 = 7
            goldenBoot: ['Jay'],
            playmaker: ['Vic'],
            brickWall: ['Vic'],
            goldenGlove: ['Kat']
        });
    });

    it('omits categories with no positive contribution that day', () => {
        const players = {
            Jay: { history: history([ballerEntry('blue', stats(2, 0, 0, 0))]) },
            Kat: { history: history([ballerEntry('white', stats(1, 0, 0, 0))]) }
        };
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-03',
            competitionDays: [6]
        });
        const stars = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'starsOfTheDay');
        expect(stars.winners.map((w) => w.category)).toEqual(['mvp', 'goldenBoot']);
    });

    it('lists all players tied at the top of a category, sorted', () => {
        const players = {
            Zed: { history: history([ballerEntry('blue', stats(0, 0, 0, 3))]) },
            Ana: { history: history([ballerEntry('white', stats(0, 0, 0, 3))]) }
        };
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-03',
            competitionDays: [6]
        });
        const stars = cardFor(cards, '2026-01-03').threads.find((t) => t.type === 'starsOfTheDay');
        const glove = stars.winners.find((w) => w.category === 'goldenGlove');
        expect(glove.players).toEqual(['Ana', 'Zed']);
    });

    it('is a reserved slot that survives the thread cap', () => {
        const cards = buildNewsFeed(ballersPlayers(), config, {
            asOf: '2026-01-03',
            competitionDays: [6],
            maxThreads: 1
        });
        const card = cardFor(cards, '2026-01-03');
        expect(card.threads.some((t) => t.type === 'starsOfTheDay')).toBe(true);
    });

    it('never appears on preview cards', () => {
        const cards = buildNewsFeed(ballersPlayers(), config, {
            asOf: '2026-01-03',
            competitionDays: [6]
        });
        expect(cards[0].threads.every((t) => t.type !== 'starsOfTheDay')).toBe(true);
    });
});

describe('momentum threads (preview only)', () => {
    // 7 played weeks so nobody is provisional going into the preview.
    // Positions are placement substrate: 1st=hot end, 4th=cold end (of 4 teams).
    function momentumPlayers() {
        const positions = {
            Amir: [4, 4, 4, 4, 1, 1, 1], // sustained surge -> red hot
            Bea: [2, 2, 2, 2, 2, 2, 2], // steady
            Cal: [3, 3, 3, 3, 3, 3, 3], // steady
            Dre: [1, 1, 1, 1, 4, 4, 4], // sustained collapse -> biggest faller
            Kat: [1, 1, 1, 4, 4, 4, 1] // deep dive, big bounce, still cold -> comeback
        };
        const teams = { Amir: 'blue', Bea: 'white', Cal: 'orange', Dre: 'green', Kat: 'black' };
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

    it('flags the sustained surger as red hot on the preview card', () => {
        const cards = buildNewsFeed(momentumPlayers(), config, {
            asOf: '2026-02-14',
            competitionDays: [6]
        });
        const thread = threadOf(cards[0], 'redHot', 'Amir');
        expect(thread).toBeDefined();
        expect(thread.value).toBeGreaterThan(0);
    });

    it('flags the recovering-but-still-cold player as a comeback brewing', () => {
        const cards = buildNewsFeed(momentumPlayers(), config, {
            asOf: '2026-02-14',
            competitionDays: [6]
        });
        const thread = threadOf(cards[0], 'comeback', 'Kat');
        expect(thread).toBeDefined();
        expect(thread.value).toBeLessThan(0);
        expect(thread.swing).toBeGreaterThan(0);
    });

    it('flags the collapsing player as the biggest faller', () => {
        const cards = buildNewsFeed(momentumPlayers(), config, {
            asOf: '2026-02-14',
            competitionDays: [6]
        });
        const thread = threadOf(cards[0], 'biggestFaller', 'Dre');
        expect(thread).toBeDefined();
        expect(thread.swing).toBeLessThan(0);
    });

    it('emits at most one momentum thread per player per card', () => {
        const cards = buildNewsFeed(momentumPlayers(), config, {
            asOf: '2026-02-14',
            competitionDays: [6]
        });
        const momentumTypes = ['redHot', 'comeback', 'biggestMover', 'biggestFaller'];
        const subjects = cards[0].threads
            .filter((t) => momentumTypes.includes(t.type))
            .map((t) => t.player);
        expect(new Set(subjects).size).toBe(subjects.length);
    });

    it('keeps momentum threads off recap cards', () => {
        const cards = buildNewsFeed(momentumPlayers(), config, {
            asOf: '2026-02-14',
            competitionDays: [6]
        });
        const momentumTypes = ['redHot', 'comeback', 'biggestMover', 'biggestFaller'];
        for (const card of cards.slice(1)) {
            expect(card.threads.every((t) => !momentumTypes.includes(t.type))).toBe(true);
        }
    });

    it('excludes provisional players from momentum threads', () => {
        const players = momentumPlayers();
        players.Newbie = {
            history: {
                '2026-02-07': champEntry('blue', 4, null),
                '2026-02-14': champEntry('blue', 1, null, { leagueWinner: true })
            }
        };
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-02-14',
            competitionDays: [6]
        });
        const momentumTypes = ['redHot', 'comeback', 'biggestMover', 'biggestFaller'];
        expect(
            cards[0].threads.some((t) => momentumTypes.includes(t.type) && t.player === 'Newbie')
        ).toBe(false);
    });
});

describe('notability and selection', () => {
    it('ranks breaking a long spoon run above extending a short trophy run', () => {
        const players = trophyPlayers([
            champEntry('blue', 2, null),
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        // Dan escapes a 3-week spoon run in week 4
        players.Dan = {
            history: history([
                champEntry('green', 4, null),
                champEntry('green', 4, null),
                champEntry('green', 4, null),
                champEntry('green', 3, null)
            ])
        };
        players.Cara.history['2026-01-24'] = champEntry('orange', 4, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const card = cardFor(cards, '2026-01-24');
        const spoonBreak = threadOf(card, 'spoonStreak', 'Dan');
        const trophyExtend = threadOf(card, 'trophyStreak', 'Chris');
        expect(spoonBreak.outcome).toBe('broken');
        expect(trophyExtend.outcome).toBe('extended');
        expect(spoonBreak.notability).toBeGreaterThan(trophyExtend.notability);
    });

    it('anchors reserved fixtures at the top ahead of higher-scored stories, honouring maxThreads', () => {
        const players = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 1, null, { leagueWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6],
            maxThreads: 2
        });
        const card = cardFor(cards, '2026-01-24');
        expect(card.threads).toHaveLength(2);
        const chris = card.threads.find((t) => t.player === 'Chris');
        const league = card.threads.find((t) => t.type === 'teamLeague');
        // Chris's 4-session trophy run outscores the league line...
        expect(chris.notability).toBeGreaterThan(league.notability);
        // ...yet the team result is anchored first.
        expect(card.threads[0].type).toBe('teamLeague');
        expect(card.threads[1].player).toBe('Chris');
    });

    it('anchors team league, team cup, then stars of the day in that order', () => {
        const stats = { goals: 3, offActions: 1, defActions: 1, saveActions: 0 };
        const players = {
            Ace: {
                history: history([
                    {
                        ...champEntry('blue', 1, 'winner', { leagueWinner: true, cupWinner: true }),
                        stats
                    }
                ])
            },
            Bo: { history: history([champEntry('white', 2, 'final')]) }
        };
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-03',
            competitionDays: [6]
        });
        const types = cardFor(cards, '2026-01-03').threads.map((t) => t.type);
        expect(types.slice(0, 3)).toEqual(['teamLeague', 'teamCup', 'starsOfTheDay']);
    });

    it('ranks long streak extensions above the double team scorelines', () => {
        const players = trophyPlayers([
            ...chrisWins3,
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 1, 'winner', { leagueWinner: true, cupWinner: true })
        ]);
        players.Ben.history['2026-01-24'] = champEntry('white', 2, null);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-31',
            competitionDays: [6]
        });
        const card = cardFor(cards, '2026-01-31');
        const extended = threadOf(card, 'trophyStreak', 'Chris');
        const league = card.threads.find((t) => t.type === 'teamLeague');
        const cup = card.threads.find((t) => t.type === 'teamCup');
        expect(extended.outcome).toBe('extended');
        expect(extended.streak).toBe(5);
        expect(league.double).toBe(true);
        expect(extended.notability).toBeGreaterThan(league.notability);
        expect(league.notability).toBeGreaterThan(cup.notability);
    });

    it('does not report a broken 2-run (churn, not news)', () => {
        const players = trophyPlayers([
            champEntry('blue', 2, null),
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 1, null, { leagueWinner: true }),
            champEntry('blue', 3, null)
        ]);
        const cards = buildNewsFeed(players, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        expect(threadOf(cardFor(cards, '2026-01-24'), 'trophyStreak', 'Chris')).toBeUndefined();
    });

    it('scores a carried-over streak below its open preview question', () => {
        const carried = trophyPlayers([...chrisWins3, null]);
        const cards = buildNewsFeed(carried, config, {
            asOf: '2026-01-24',
            competitionDays: [6]
        });
        const recapThread = threadOf(cardFor(cards, '2026-01-24'), 'trophyStreak', 'Chris');
        const previewThread = threadOf(cards[0], 'trophyStreak', 'Chris');
        expect(recapThread.outcome).toBe('carriedOver');
        expect(previewThread.notability).toBeGreaterThan(recapThread.notability);
    });
});
