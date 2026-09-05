import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

const dataGet = vi.fn();
const updateScores = vi.fn();

vi.mock('$lib/server/data.js', () => ({ data: { get: (...a) => dataGet(...a) } }));
vi.mock('$lib/server/settings.js', () => ({ getConsolidatedSettings: vi.fn(async () => ({})) }));
vi.mock('$lib/server/league.js', () => ({
    validateLeagueForAPI: vi.fn(() => ({ leagueId: 'pirates', isValid: true }))
}));
vi.mock('$lib/server/knockoutManager.js', () => ({
    createKnockoutManager: vi.fn(() => ({ updateScores: (...a) => updateScores(...a) }))
}));
vi.mock('$lib/server/logger.js', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

const { POST } = await import('../../../../src/routes/api/games/knockout/+server.js');

const DATE = '2026-09-05';

const TEAMS = {
    'blue outlaws': ['Jonathen', 'Dan', 'Wayne', 'Bobinho', 'Dave'],
    'white fighters': ['Jay', 'Cwenga', 'Offie', 'Mufasa', 'Chris']
};

/** The semi as it stood before the edit: a 2-2 draw settled 0-2 on penalties. */
function drawnSemi(overrides = {}) {
    return {
        round: 'semi',
        match: 1,
        home: 'blue outlaws',
        away: 'white fighters',
        homeScore: 2,
        awayScore: 2,
        homeScorers: { Jonathen: 2 },
        awayScorers: { Cwenga: 1, Jay: 1 },
        homePenalties: 0,
        awayPenalties: 2,
        ...overrides
    };
}

function post(bracket) {
    return POST({
        request: new Request('http://pirates.leagr.co.za/api/games/knockout', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ operation: 'updateScores', bracket })
        }),
        url: new URL(`http://pirates.leagr.co.za/api/games/knockout?date=${DATE}`),
        locals: { adminUnlockDate: DATE }
    });
}

/** Run the handler and normalise whatever it throws into a status/message pair. */
async function statusOf(bracket) {
    try {
        const res = await post(bracket);
        return { status: res.status, body: await res.json() };
    } catch (err) {
        if (isHttpError(err)) return { status: err.status, message: err.body.message };
        throw err;
    }
}

describe('POST /api/games/knockout - updateScores', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataGet.mockResolvedValue(TEAMS);
        updateScores.mockImplementation(async (_date, bracket) => bracket);
    });

    describe('the 2026-09-05 semi-final scorer edit', () => {
        it('accepts adding a scorer even though it breaks the draw', async () => {
            // Offie added; awayScore rises to 3 while the shootout is still on record.
            // This is the exact payload that returned a 500.
            const bracket = [
                drawnSemi({ awayScore: 3, awayScorers: { Cwenga: 1, Jay: 1, Offie: 1 } })
            ];

            const { status } = await statusOf(bracket);

            expect(status).toBe(200);
        });

        it('drops the stale shootout instead of rejecting the edit', async () => {
            const bracket = [
                drawnSemi({ awayScore: 3, awayScorers: { Cwenga: 1, Jay: 1, Offie: 1 } })
            ];

            await post(bracket);

            const [, saved] = updateScores.mock.calls[0];
            expect(saved[0].homePenalties).toBeNull();
            expect(saved[0].awayPenalties).toBeNull();
        });

        it('works in the other edit order too - removing a scorer first', async () => {
            // Cwenga removed first: 2-1, also no longer a draw.
            const bracket = [drawnSemi({ awayScore: 1, awayScorers: { Jay: 1 } })];

            const { status } = await statusOf(bracket);

            expect(status).toBe(200);
        });

        it('keeps the shootout when the score is still level', async () => {
            const bracket = [drawnSemi({ awayScorers: { Offie: 1, Jay: 1 } })];

            await post(bracket);

            const [, saved] = updateScores.mock.calls[0];
            expect(saved[0].homePenalties).toBe(0);
            expect(saved[0].awayPenalties).toBe(2);
        });
    });

    describe('real validation failures keep their own status and message', () => {
        it('rejects a half-set shootout as 400, not 500', async () => {
            const bracket = [drawnSemi({ awayPenalties: null })];

            const { status, message } = await statusOf(bracket);

            expect(status).toBe(400);
            expect(message).toBe('Both home and away penalty scores must be set together');
        });

        it('rejects an out-of-range penalty score as 400, not 500', async () => {
            const bracket = [drawnSemi({ awayPenalties: -1 })];

            const { status } = await statusOf(bracket);

            expect(status).toBe(400);
        });

        it('surfaces the scorer-validation message rather than a generic 500', async () => {
            const bracket = [drawnSemi({ awayScorers: { Cwenga: 1, Jay: 1, Nobody: 5 } })];

            const { status, message } = await statusOf(bracket);

            expect(status).toBe(400);
            expect(message).toMatch(/Scorer validation failed/);
        });

        it('rejects an unknown operation as 400', async () => {
            const res = POST({
                request: new Request('http://pirates.leagr.co.za/api/games/knockout', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ operation: 'demolish' })
                }),
                url: new URL(`http://pirates.leagr.co.za/api/games/knockout?date=${DATE}`),
                locals: { adminUnlockDate: DATE }
            });

            await expect(res).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('penalty checks no longer depend on the teams file', () => {
        it('still validates penalties when no teams are set', async () => {
            dataGet.mockResolvedValue(null);
            const bracket = [drawnSemi({ awayPenalties: null })];

            const { status, message } = await statusOf(bracket);

            expect(status).toBe(400);
            expect(message).toBe('Both home and away penalty scores must be set together');
        });
    });
});
