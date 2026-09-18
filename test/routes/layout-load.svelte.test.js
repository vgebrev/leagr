import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (/** @type {string} */ p) => p }));

const { load } = await import('../../src/routes/+layout.js');
const { api, getLeagueId } = await import('../../src/lib/client/services/api-client.svelte.js');
const { storeAccessCode } = await import('../../src/lib/client/services/auth.js');

/** Minimal layout data, as +layout.server.js returns it. */
function layoutData(leagueId = 'pirates') {
    return {
        leagueId,
        leagueInfo: { id: leagueId, name: 'Pirates', icon: 'soccer', hasOwnerEmail: true },
        date: '2026-09-12',
        settings: {},
        appUrl: 'http://pirates.leagr.local'
    };
}

describe('root layout load', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('sets the league id on the API client', async () => {
        await load({
            data: layoutData(),
            url: new URL('http://pirates.leagr.local/players'),
            fetch: vi.fn()
        });

        expect(getLeagueId()).toBe('pirates');
    });

    // The regression this guards: setLeagueId used to live in a +layout.svelte $effect.
    // Svelte 5 flushes effects child-first, so it ran *after* each page's onMount and the
    // first request of every full page load went out unauthenticated - a 403 that wiped
    // the stored access code. The league id has to be set before load() resolves.
    it('leaves the API client able to authenticate a request made straight after load', async () => {
        storeAccessCode('pirates', 'ABCD-EFGH-IJKL');

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({})
        });

        await load({
            data: layoutData(),
            url: new URL('http://pirates.leagr.local/players'),
            fetch: fetchMock
        });

        await api.get('players', '2026-09-12');

        const [, init] = fetchMock.mock.calls.at(-1);
        expect(init.headers['Authorization']).toBe('ABCD-EFGH-IJKL');
    });
});
