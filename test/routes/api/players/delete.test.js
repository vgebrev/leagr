import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

const getData = vi.fn();
const removePlayer = vi.fn();
const getOwnedPlayersForCurrentClient = vi.fn();

/** A chainable stand-in for the real fluent manager. */
function managerStub() {
    const stub = {
        setDate: () => stub,
        setLeague: () => stub,
        setAccessControl: () => stub,
        getData: (/** @type {any} */ o) => getData(o),
        removePlayer: (/** @type {any} */ n) => removePlayer(n),
        getOwnedPlayersForCurrentClient: () => getOwnedPlayersForCurrentClient()
    };
    return stub;
}

vi.mock('$lib/server/playerManager.js', () => ({ createPlayerManager: () => managerStub() }));
vi.mock('$lib/server/playerAccessControl.js', () => ({
    createPlayerAccessControl: () => ({ setContext: () => ({}) })
}));
vi.mock('$lib/server/discipline.js', () => ({ createDisciplineManager: vi.fn() }));
vi.mock('$lib/server/rankings.js', () => ({ createRankingsManager: vi.fn() }));
vi.mock('$lib/server/logger.js', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

const { DELETE } = await import('../../../../src/routes/api/players/+server.js');

const DATE = '2026-09-15';

function del(body = { playerName: 'Velislav', list: 'available' }) {
    return DELETE({
        request: new Request(`http://pirates.leagr.co.za/api/players?date=${DATE}`, {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        }),
        url: new URL(`http://pirates.leagr.co.za/api/players?date=${DATE}`),
        locals: {
            leagueId: 'pirates',
            clientId: 'lcid_test',
            isAdmin: false,
            adminUnlockDate: null
        }
    });
}

describe('DELETE /api/players', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // DATE is fixed, so without pinning the clock these tests start failing
        // the competition-ended gate the moment that date falls into the past.
        // Only Date is faked - timer-driven async is left alone.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(`${DATE}T08:00:00`));
        // What the route actually asks for: settings only, no players.
        getData.mockResolvedValue({ settings: { [DATE]: {}, competitionDays: [6] } });
        removePlayer.mockResolvedValue({ players: { available: [], waitingList: [] } });
        getOwnedPlayersForCurrentClient.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // The route loads settings with `players: false`, so a guard that also required
    // gameData.players made every delete fail with "Session data could not be loaded".
    it('removes the player when only settings were loaded', async () => {
        const response = await del();

        expect(removePlayer).toHaveBeenCalledWith('Velislav');
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            available: [],
            waitingList: [],
            ownedByMe: []
        });
    });

    it('asks for settings without players', async () => {
        await del();
        expect(getData).toHaveBeenCalledWith({ players: false, teams: false, settings: true });
    });

    it('still fails loudly when settings really are missing', async () => {
        getData.mockResolvedValue({ settings: null });

        await expect(del()).rejects.toSatisfy(
            (/** @type {unknown} */ e) => isHttpError(e) && e.status === 500
        );
        expect(removePlayer).not.toHaveBeenCalled();
    });
});
