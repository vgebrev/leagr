import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { createFantasyManager, FantasyError } from '$lib/server/fantasyManager.js';
import { createPlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { invalidateSettingsCache } from '$lib/server/settingsCache.js';

const LEAGUE_ID = 'test-fantasy-league';
const DATA_PATH = path.join(process.cwd(), 'data', LEAGUE_ID);
const SESSION_DATE = '2026-09-05';

/** Sessions that build the price history, all inside one stat-tracking regime. */
const HISTORY_DATES = ['2026-07-04', '2026-07-11', '2026-07-18', '2026-07-25', '2026-08-01'];

/**
 * A pool where scoring is deliberately spread, so prices span the 4.0-12.0 band and a
 * budget genuinely forces a choice.
 * @type {Array<[string, number, number]>} [name, goalsPerSession, elo]
 */
const POOL = [
    ['Ace', 4, 1400],
    ['Bruno', 3, 1330],
    ['Cass', 2.5, 1290],
    ['Dee', 2, 1250],
    ['Eli', 1.5, 1210],
    ['Fin', 1, 1180],
    ['Gus', 0.5, 1150],
    ['Hana', 0.25, 1120],
    ['Ines', 0, 1090],
    ['Jonah', 0, 1050]
];

/**
 * Build a rankings file whose history is rich enough for buildWeeklyPrices to price the
 * pool: every session records all four stat types, so they form a single regime.
 * @param {string[]} dates
 */
function buildRankings(dates) {
    /** @type {Record<string, any>} */
    const players = {};

    for (const [name, goals, elo] of POOL) {
        /** @type {Record<string, any>} */
        const history = {};
        for (const date of dates) {
            history[date] = {
                points: { match: 3, knockout: 0 },
                stats: {
                    goals,
                    offActions: goals * 2,
                    defActions: 1,
                    saveActions: 0
                },
                ratings: { elo },
                performance: { leagueWinner: false, cupWinner: false }
            };
        }
        players[name] = { history, ratings: { elo } };
    }

    return { lastUpdated: '2026-08-01T12:00:00.000Z', calculatedDates: [...dates], players };
}

/**
 * @param {Object} [overrides]
 */
async function writeSession(overrides = {}) {
    const session = {
        players: {
            available: POOL.map(([name]) => name),
            waitingList: []
        },
        playerOwners: {},
        ...overrides
    };
    await fs.writeFile(
        path.join(DATA_PATH, `${SESSION_DATE}.json`),
        JSON.stringify(session, null, 2)
    );
}

/**
 * @param {string[]} [dates]
 */
async function writeRankings(dates = HISTORY_DATES) {
    await fs.writeFile(
        path.join(DATA_PATH, 'rankings-2026.json'),
        JSON.stringify(buildRankings(dates), null, 2)
    );
}

/**
 * @param {Object} [settings] - league settings overrides
 */
async function writeLeagueInfo(settings = {}) {
    await fs.writeFile(
        path.join(DATA_PATH, 'info.json'),
        JSON.stringify(
            {
                id: LEAGUE_ID,
                name: 'Fantasy Test League',
                accessCode: 'AAAA-BBBB-CCCC',
                adminCode: 'DDDD-EEEE-FFFF',
                settings: {
                    competitionDays: [6],
                    // Disabled so the window is driven purely by the helpers' fallbacks;
                    // individual tests re-enable it when they need a specific gate.
                    registrationWindow: { enabled: false },
                    ...settings
                }
            },
            null,
            2
        )
    );
    invalidateSettingsCache(LEAGUE_ID);
}

/**
 * @param {string} clientId
 * @param {boolean} [isAdmin]
 */
function managerFor(clientId, isAdmin = false) {
    return createFantasyManager()
        .setLeague(LEAGUE_ID)
        .setDate(SESSION_DATE)
        .setAccessControl(
            createPlayerAccessControl().setContext(SESSION_DATE, LEAGUE_ID, clientId, isAdmin)
        );
}

/** @param {string} clientId */
function ownerIdFor(clientId) {
    return createPlayerAccessControl()
        .setContext(SESSION_DATE, LEAGUE_ID, clientId, false)
        .deriveOwnerId();
}

async function readStored() {
    const raw = await fs.readFile(path.join(DATA_PATH, 'fantasy', `${SESSION_DATE}.json`), 'utf-8');
    return JSON.parse(raw);
}

describe('FantasyManager', () => {
    beforeEach(async () => {
        await fs.mkdir(DATA_PATH, { recursive: true });
        await writeLeagueInfo();
        await writeSession();
        await writeRankings();
    });

    afterEach(async () => {
        vi.useRealTimers();
        invalidateSettingsCache(LEAGUE_ID);
        await fs.rm(DATA_PATH, { recursive: true, force: true });
    });

    describe('setup', () => {
        it('requires a league and a date before resolving a file path', () => {
            expect(() => createFantasyManager().getFilePath()).toThrow(FantasyError);
            expect(() => createFantasyManager().setLeague(LEAGUE_ID).getFilePath()).toThrow(
                FantasyError
            );
        });

        it('stores the session in a fantasy subdirectory of the league', () => {
            const filePath = createFantasyManager()
                .setLeague(LEAGUE_ID)
                .setDate(SESSION_DATE)
                .getFilePath();
            expect(filePath).toBe(path.join(DATA_PATH, 'fantasy', `${SESSION_DATE}.json`));
        });
    });

    describe('market', () => {
        it('prices the signup pool with a budget that forces a choice', async () => {
            const state = await managerFor('client-a').getState();

            expect(state.market.length).toBe(POOL.length);
            expect(state.market[0].price).toBeGreaterThan(
                state.market[state.market.length - 1].price
            );
            expect(state.budget).toBeGreaterThan(0);

            const topSquadCost = state.market
                .slice(0, state.squadSize)
                .reduce((sum, p) => sum + p.price, 0);
            expect(state.budget).toBeLessThan(topSquadCost);
        });

        it('does not write a file just for reading the market', async () => {
            await managerFor('client-a').getState();
            await expect(readStored()).rejects.toThrow();
        });

        it('reports an unfrozen market as unlocked', async () => {
            const state = await managerFor('client-a').getState();
            expect(state.locked).toBe(false);
        });

        it('returns an empty market when no rankings predate the session', async () => {
            await writeRankings(['2026-09-12']);
            const state = await managerFor('client-a').getState();

            expect(state.market).toEqual([]);
            expect(state.budget).toBe(0);
        });
    });

    describe('saveEntry', () => {
        /**
         * Pick the cheapest affordable squad, so the test never depends on exact prices.
         * @param {Object} state
         */
        function affordableSquad(state) {
            return [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
        }

        it('saves a squad and returns it as myEntry', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            const players = affordableSquad(before);

            const state = await manager.saveEntry({ teamName: 'Dream Team', players });

            expect(state.myEntry).toMatchObject({
                teamName: 'Dream Team',
                players,
                isMine: true,
                rank: 1
            });
            expect(state.entries).toHaveLength(1);
        });

        it('freezes the market on the first squad and never moves it again', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            await manager.saveEntry({ teamName: 'First In', players: affordableSquad(before) });

            const frozen = await readStored();
            expect(frozen.board).toBeTruthy();
            expect(frozen.board.lockedAt).toBeTruthy();

            // A late signup changes the pool; the frozen market must not notice.
            await writeSession({
                players: { available: [...POOL.map(([n]) => n), 'Latecomer'], waitingList: [] }
            });

            const after = await managerFor('client-b').getState();
            expect(after.locked).toBe(true);
            expect(after.budget).toBe(before.budget);
            expect(after.market.map((p) => p.playerName)).not.toContain('Latecomer');
            expect(after.market.map((p) => p.price)).toEqual(before.market.map((p) => p.price));
        });

        it('flags a pick who withdrew after the market froze', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            const players = affordableSquad(before);
            await manager.saveEntry({ teamName: 'Unlucky', players });

            await writeSession({
                players: {
                    available: POOL.map(([n]) => n).filter((n) => n !== players[0]),
                    waitingList: []
                }
            });

            const after = await manager.getState();
            const withdrawn = after.market.find((p) => p.playerName === players[0]);
            expect(withdrawn.withdrawn).toBe(true);
            expect(after.market.filter((p) => p.withdrawn)).toHaveLength(1);
        });

        it('upserts rather than appending for the same owner', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            const players = affordableSquad(before);

            await manager.saveEntry({ teamName: 'First Name', players });
            const createdAt = (await readStored()).entries[0].createdAt;

            const state = await manager.saveEntry({ teamName: 'Second Name', players });

            expect(state.entries).toHaveLength(1);
            expect(state.myEntry.teamName).toBe('Second Name');

            const stored = await readStored();
            expect(stored.entries).toHaveLength(1);
            // An edit keeps the original entry rather than replacing it wholesale.
            expect(stored.entries[0].createdAt).toBe(createdAt);
        });

        it('keeps separate owners in separate entries', async () => {
            const a = managerFor('client-a');
            const b = managerFor('client-b');
            const players = affordableSquad(await a.getState());

            await a.saveEntry({ teamName: 'Team A', players });
            await b.saveEntry({ teamName: 'Team B', players });

            const state = await b.getState();
            expect(state.entries).toHaveLength(2);
            expect(state.entries.filter((e) => e.isMine)).toHaveLength(1);
            expect(state.myEntry.teamName).toBe('Team B');
        });

        it('rejects a squad of the wrong size', async () => {
            const manager = managerFor('client-a');
            const players = affordableSquad(await manager.getState());

            await expect(
                manager.saveEntry({ teamName: 'Too Few', players: players.slice(0, 2) })
            ).rejects.toThrow(/exactly 5 players/);
        });

        it('rejects a duplicated player', async () => {
            const manager = managerFor('client-a');
            const players = affordableSquad(await manager.getState());
            const duplicated = [players[0], players[0], players[1], players[2], players[3]];

            await expect(
                manager.saveEntry({ teamName: 'Clones', players: duplicated })
            ).rejects.toThrow(/same player twice/);
        });

        it('rejects a player who is not in the market', async () => {
            const manager = managerFor('client-a');
            const players = affordableSquad(await manager.getState());

            await expect(
                manager.saveEntry({ teamName: 'Ringer', players: [...players.slice(1), 'Nobody'] })
            ).rejects.toThrow(/Nobody/);
        });

        it('rejects a squad over budget', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const priciest = [...state.market]
                .sort((a, b) => b.price - a.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);

            await expect(
                manager.saveEntry({ teamName: 'Galacticos', players: priciest })
            ).rejects.toThrow(/over your/);
        });

        it('rejects an unsafe team name', async () => {
            const manager = managerFor('client-a');
            const players = affordableSquad(await manager.getState());

            await expect(manager.saveEntry({ teamName: '   ', players })).rejects.toThrow(
                FantasyError
            );
        });

        it('rejects a client with no identity', async () => {
            const manager = createFantasyManager()
                .setLeague(LEAGUE_ID)
                .setDate(SESSION_DATE)
                .setAccessControl(
                    createPlayerAccessControl().setContext(SESSION_DATE, LEAGUE_ID, null, false)
                );

            await expect(
                manager.saveEntry({ teamName: 'Ghost', players: ['Ace'] })
            ).rejects.toThrow(/identify you/);
        });
    });

    describe('owner name', () => {
        it("resolves to the owner's first registered player", async () => {
            await writeSession({
                playerOwners: { Ace: ownerIdFor('client-a'), Bruno: ownerIdFor('client-a') }
            });

            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);

            const saved = await manager.saveEntry({ teamName: 'Mine', players });
            expect(saved.myEntry.ownerName).toBe('Ace');

            const stored = await readStored();
            expect(stored.entries[0].ownerName).toBe('Ace');
        });

        it('falls back to the stored name once the owner deregisters', async () => {
            await writeSession({ playerOwners: { Ace: ownerIdFor('client-a') } });

            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'Mine', players });

            await writeSession({ playerOwners: {} });
            const after = await manager.getState();
            expect(after.entries[0].ownerName).toBe('Ace');
        });

        it('shows Anonymous when the owner never registered a player', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);

            const saved = await manager.saveEntry({ teamName: 'Mine', players });
            expect(saved.myEntry.ownerName).toBe('Anonymous');
        });

        it('never exposes an owner hash to the client', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);

            const saved = await manager.saveEntry({ teamName: 'Mine', players });
            expect(JSON.stringify(saved)).not.toContain(ownerIdFor('client-a'));
            expect(saved.entries[0].owner).toBeUndefined();
        });
    });

    describe('deleteEntry', () => {
        it('removes only the calling owner’s squad', async () => {
            const a = managerFor('client-a');
            const b = managerFor('client-b');
            const state = await a.getState();
            const players = [...state.market]
                .sort((x, y) => x.price - y.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);

            await a.saveEntry({ teamName: 'Team A', players });
            await b.saveEntry({ teamName: 'Team B', players });

            const after = await a.deleteEntry();
            expect(after.myEntry).toBeNull();
            expect(after.entries).toHaveLength(1);
            expect(after.entries[0].teamName).toBe('Team B');
        });

        it('reports a missing squad rather than silently succeeding', async () => {
            await expect(managerFor('client-a').deleteEntry()).rejects.toThrow(
                /do not have a squad/
            );
        });
    });

    describe('window state', () => {
        const REGISTRATION_WINDOW = {
            enabled: true,
            startDayOffset: -2,
            startTime: '07:30',
            teamDrawDayOffset: -1,
            teamDrawTime: '16:00',
            endDayOffset: 0,
            endTime: '12:00'
        };

        it('is pending before the team draw opens', async () => {
            await writeLeagueInfo({ registrationWindow: REGISTRATION_WINDOW });
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-09-04T10:00:00'));

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('pending');
            expect(state.windowReason).toMatch(/opens when teams are drawn/);
        });

        // A 403 makes the client clear its league access and bounce to /auth, so a manager
        // who saves the moment the whistle goes must not be logged out for it.
        it('refuses a locked save with a status that does not log the client out', async () => {
            await writeSession({
                games: {
                    rounds: [[{ home: 'blue', away: 'white', homeScore: 2, awayScore: 1 }]]
                }
            });
            const manager = managerFor('client-a');

            await expect(
                manager.saveEntry({ teamName: 'Too Late', players: ['Ace'] })
            ).rejects.toMatchObject({ statusCode: 400 });
            await expect(manager.deleteEntry()).rejects.toMatchObject({ statusCode: 400 });
        });

        it('refuses a squad while pending', async () => {
            await writeLeagueInfo({ registrationWindow: REGISTRATION_WINDOW });
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-09-04T10:00:00'));

            await expect(manager.saveEntry({ teamName: 'Early', players })).rejects.toThrow(
                /opens when teams are drawn/
            );
        });

        it('is open between the team draw and the first result', async () => {
            await writeLeagueInfo({ registrationWindow: REGISTRATION_WINDOW });
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-09-04T18:00:00'));

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('open');
        });

        it('closes once the first match has a score', async () => {
            await writeSession({
                games: {
                    rounds: [
                        [{ home: 'blue', away: 'white', homeScore: 2, awayScore: 1 }],
                        [{ home: 'blue', away: 'white', homeScore: null, awayScore: null }]
                    ]
                }
            });

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('closed');
            expect(state.windowReason).toMatch(/kicked off/);
        });

        it('stays open while the first match is still goalless on the sheet', async () => {
            await writeSession({
                games: {
                    rounds: [
                        [
                            { bye: 'green' },
                            { home: 'blue', away: 'white', homeScore: null, awayScore: null }
                        ]
                    ]
                }
            });

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('open');
        });

        it('closes once the competition has ended', async () => {
            await writeLeagueInfo({ registrationWindow: REGISTRATION_WINDOW });
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-09-05T14:00:00'));

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('closed');
            expect(state.windowReason).toMatch(/session has ended/);
        });

        it('reopens for an admin who unlocked this session', async () => {
            await writeLeagueInfo({ registrationWindow: REGISTRATION_WINDOW });
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-09-05T14:00:00'));

            const state = await managerFor('client-a', true).getState({
                adminUnlockDate: SESSION_DATE
            });
            expect(state.windowState).toBe('open');
        });
    });

    describe('settlement', () => {
        /**
         * Add the session itself to rankings, which is what makes it settleable.
         * @param {Record<string, number>} goalsByPlayer
         */
        async function settleWith(goalsByPlayer) {
            const rankings = buildRankings(HISTORY_DATES);
            rankings.calculatedDates.push(SESSION_DATE);
            for (const [name, goals] of Object.entries(goalsByPlayer)) {
                rankings.players[name].history[SESSION_DATE] = {
                    points: { match: 3, knockout: 0 },
                    stats: { goals, offActions: 0, defActions: 0, saveActions: 0 },
                    ratings: { elo: 1200 },
                    performance: { leagueWinner: false, cupWinner: false }
                };
            }
            await fs.writeFile(
                path.join(DATA_PATH, 'rankings-2026.json'),
                JSON.stringify(rankings, null, 2)
            );
        }

        it('stays unsettled until rankings know about the session', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'Waiting', players });

            const after = await manager.getState();
            expect(after.settled).toBe(false);
            expect(after.myEntry.points).toBeNull();
        });

        it('scores a squad from the same rules the prices used', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'Settled', players });

            // Appearance 2 + 4 x goals + 0.5 x matchPoints(3) = 3.5 + 4 x goals each.
            await settleWith(Object.fromEntries(players.map((name) => [name, 1])));

            const after = await manager.getState();
            expect(after.settled).toBe(true);
            expect(after.myEntry.points).toBeCloseTo(players.length * 7.5, 5);

            const stored = await readStored();
            expect(stored.results.settledAt).toBeTruthy();
            expect(stored.entries[0].points).toBeCloseTo(players.length * 7.5, 5);
        });

        it('scores a pick who did not play as zero', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'One Short', players });

            const attended = players.slice(1);
            await settleWith(Object.fromEntries(attended.map((name) => [name, 1])));

            const after = await manager.getState();
            expect(after.myEntry.points).toBeCloseTo(attended.length * 7.5, 5);
            expect(after.market.find((p) => p.playerName === players[0]).points).toBeNull();
        });

        it('ranks a settled leaderboard by points', async () => {
            const a = managerFor('client-a');
            const b = managerFor('client-b');
            const state = await a.getState();
            const cheap = [...state.market].sort((x, y) => x.price - y.price);
            const squadA = cheap.slice(0, state.squadSize).map((p) => p.playerName);
            const squadB = cheap.slice(1, state.squadSize + 1).map((p) => p.playerName);

            await a.saveEntry({ teamName: 'Team A', players: squadA });
            await b.saveEntry({ teamName: 'Team B', players: squadB });

            // Only B's exclusive pick scores, so B must come first.
            await settleWith({ [squadB[squadB.length - 1]]: 5 });

            const after = await a.getState();
            expect(after.entries[0].teamName).toBe('Team B');
            expect(after.entries[0].rank).toBe(1);
            expect(after.entries[1].points).toBe(0);
        });

        it('re-settles when a score is corrected', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'Corrected', players });

            await settleWith({ [players[0]]: 1 });
            const first = await manager.getState();

            await settleWith({ [players[0]]: 3 });
            const second = await manager.getState();

            expect(second.myEntry.points).toBeGreaterThan(first.myEntry.points);
            const stored = await readStored();
            expect(stored.entries[0].points).toBe(second.myEntry.points);
        });
    });
});
