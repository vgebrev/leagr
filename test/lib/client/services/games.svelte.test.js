import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/client/services/api-client.svelte.js', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        remove: vi.fn()
    }
}));

vi.mock('$lib/client/stores/notification.js', () => ({
    setNotification: vi.fn()
}));

vi.mock('$lib/client/stores/loading.js', () => ({
    withLoading: vi.fn(async (fn, onError) => {
        try {
            return await fn();
        } catch (error) {
            onError?.(error);
        }
    })
}));

const DATE = '2026-07-25';

describe('GamesService scoreline seeding', () => {
    /** @type {any} */
    let gamesService;
    /** @type {any} */
    let api;

    /**
     * A match as it exists before anyone touches it: no score at all.
     * @param {Object} [extra]
     */
    function blankMatch(extra = {}) {
        return { home: 'Blue', away: 'Orange', homeScore: null, awayScore: null, ...extra };
    }

    /** The league match as it was posted to the API. */
    function savedLeagueMatch() {
        return api.post.mock.calls[0][2].rounds[0][0];
    }

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        ({ gamesService } = await import('$lib/client/services/games.svelte.js'));
        ({ api } = await import('$lib/client/services/api-client.svelte.js'));

        // Echo the request back, which is shaped like the real response.
        api.post.mockImplementation(async (/** @type {any} */ _r, /** @type {any} */ _d, body) => ({
            ...body,
            rounds: body.rounds
        }));

        gamesService.currentDate = DATE;
        gamesService.anchorIndex = 0;
        gamesService.schedule = [[blankMatch()]];
        gamesService.knockoutBracket = null;
    });

    describe('startScoring', () => {
        it('opens an unplayed match at 0-0 and saves it', async () => {
            await gamesService.startScoring('league', '1', '1');

            expect(api.post).toHaveBeenCalledTimes(1);
            expect(savedLeagueMatch()).toMatchObject({ homeScore: 0, awayScore: 0 });
        });

        it('leaves a match that already has a score alone', async () => {
            gamesService.schedule = [[blankMatch({ homeScore: 2, awayScore: 1 })]];

            await gamesService.startScoring('league', '1', '1');

            expect(api.post).not.toHaveBeenCalled();
        });

        it('leaves a 0-0 already on record alone rather than re-posting it', async () => {
            gamesService.schedule = [[blankMatch({ homeScore: 0, awayScore: 0 })]];

            await gamesService.startScoring('league', '1', '1');

            expect(api.post).not.toHaveBeenCalled();
        });

        it('is a no-op when the match cannot be found', async () => {
            await gamesService.startScoring('league', '9', '9');

            expect(api.post).not.toHaveBeenCalled();
        });

        it('routes a knockout match through the knockout endpoint', async () => {
            gamesService.knockoutBracket = {
                bracket: [{ round: 'final', match: 1, ...blankMatch() }]
            };
            api.post.mockImplementation(
                async (/** @type {any} */ _r, /** @type {any} */ _d, /** @type {any} */ body) => ({
                    knockoutGames: { bracket: body.bracket }
                })
            );

            await gamesService.startScoring('knockout', 'final', '1');

            expect(api.post).toHaveBeenCalledWith(
                'games/knockout',
                DATE,
                expect.objectContaining({ operation: 'updateScores' })
            );
            expect(api.post.mock.calls[0][2].bracket[0]).toMatchObject({
                homeScore: 0,
                awayScore: 0
            });
        });
    });

    describe('applyPlayerAction', () => {
        it.each([
            ['offensive', 'homeOffensiveActions'],
            ['defensive', 'homeDefensiveActions'],
            ['saves', 'homeSaveActions']
        ])('opens the score at 0-0 when a %s stat is recorded', async (mode, field) => {
            await gamesService.applyPlayerAction('league', '1', '1', 'home', 'Amir', mode, 1);

            const saved = savedLeagueMatch();
            expect(saved).toMatchObject({ homeScore: 0, awayScore: 0 });
            expect(saved[field]).toEqual({ Amir: 1 });
        });

        it('seeds from an away stat too', async () => {
            await gamesService.applyPlayerAction('league', '1', '1', 'away', 'Dre', 'defensive', 1);

            expect(savedLeagueMatch()).toMatchObject({ homeScore: 0, awayScore: 0 });
        });

        it('does not invent a score when a stat is being taken back', async () => {
            gamesService.schedule = [[blankMatch({ homeSaveActions: { Amir: 1 } })]];

            await gamesService.applyPlayerAction('league', '1', '1', 'home', 'Amir', 'saves', -1);

            expect(savedLeagueMatch()).toMatchObject({ homeScore: null, awayScore: null });
        });

        it('leaves a recorded scoreline untouched', async () => {
            gamesService.schedule = [[blankMatch({ homeScore: 3, awayScore: 1 })]];

            await gamesService.applyPlayerAction('league', '1', '1', 'away', 'Dre', 'offensive', 1);

            expect(savedLeagueMatch()).toMatchObject({ homeScore: 3, awayScore: 1 });
        });

        it('still opens the score at 1-0 for a goal', async () => {
            await gamesService.applyPlayerAction('league', '1', '1', 'home', 'Amir', 'goals', 1);

            const saved = savedLeagueMatch();
            expect(saved).toMatchObject({ homeScore: 1, awayScore: 0 });
            expect(saved.homeScorers).toEqual({ Amir: 1 });
        });

        it('seeds a knockout match on a non-goal stat', async () => {
            gamesService.knockoutBracket = {
                bracket: [{ round: 'semi', match: 2, ...blankMatch() }]
            };
            api.post.mockImplementation(
                async (/** @type {any} */ _r, /** @type {any} */ _d, /** @type {any} */ body) => ({
                    knockoutGames: { bracket: body.bracket }
                })
            );

            await gamesService.applyPlayerAction(
                'knockout',
                'semi',
                '2',
                'home',
                'Amir',
                'saves',
                1
            );

            expect(api.post.mock.calls[0][2].bracket[0]).toMatchObject({
                homeScore: 0,
                awayScore: 0
            });
        });
    });
});
