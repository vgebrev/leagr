import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { createFantasyManager, FantasyError } from '$lib/server/fantasyManager.js';
import { createPlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { invalidateSettingsCache } from '$lib/server/settingsCache.js';

const LEAGUE_ID = 'test-fantasy-league';
const DATA_PATH = path.join(process.cwd(), 'data', LEAGUE_ID);
const SESSION_DATE = '2026-09-05';

/** "Now" for every test that does not pin its own: the day before the session. */
const DEFAULT_NOW = '2026-09-04T10:00:00';

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
        // Pin the clock. SESSION_DATE is hard-coded, so without this every window check
        // drifts into 'closed' the moment that date falls into the past and the whole
        // suite starts failing on a calendar change rather than a code change.
        vi.useFakeTimers();
        vi.setSystemTime(new Date(DEFAULT_NOW));

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

        // The scoring rules are league-tunable and regime-dependent, so the page that
        // explains them reads them off the payload rather than hard-coding a copy.
        it('publishes the scoring rules the session is judged by', async () => {
            const state = await managerFor('client-a').getState();

            expect(state.scoring.appearance).toBe(2);
            expect(state.scoring.goal).toBe(4);
            expect(state.statTypes).toEqual(['goals', 'offActions', 'defActions', 'saveActions']);
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

        it('leaves the market live after the first squad, so a late signup is priced', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            await manager.saveEntry({ teamName: 'First In', players: affordableSquad(before) });

            // Saving must not pin the market - that is what shut late signups out.
            const stored = await readStored();
            expect(stored.board).toBeNull();

            // Withdrawing the top earner re-prices the pool for everyone.
            await writeSession({
                players: {
                    available: POOL.map(([n]) => n).filter((n) => n !== 'Ace'),
                    waitingList: []
                }
            });

            const after = await managerFor('client-b').getState();
            expect(after.locked).toBe(false);
            expect(after.market.map((p) => p.playerName)).not.toContain('Ace');
            expect(after.market.map((p) => p.price)).not.toEqual(
                before.market.filter((p) => p.playerName !== 'Ace').map((p) => p.price)
            );
        });

        it('drops a pick who withdrew from the live market and names them on the entry', async () => {
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
            expect(after.market.map((p) => p.playerName)).not.toContain(players[0]);
            expect(after.myEntry.withdrawnPlayers).toEqual([players[0]]);
            // Costs nothing and scores nothing, but the squad is still legal.
            expect(after.myEntry.valid).toBe(true);
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

        it('records a captain chosen from the squad', async () => {
            const manager = managerFor('client-a');
            const players = affordableSquad(await manager.getState());

            const state = await manager.saveEntry({
                teamName: 'Armband',
                players,
                captain: players[1]
            });

            expect(state.myEntry.captain).toBe(players[1]);
            expect((await readStored()).entries[0].captain).toBe(players[1]);
        });

        it('rejects a captain who is not in the squad', async () => {
            const manager = managerFor('client-a');
            const players = affordableSquad(await manager.getState());

            // Ace is the priciest player, so the cheapest squad never contains him.
            await expect(
                manager.saveEntry({ teamName: 'Outsider', players, captain: 'Ace' })
            ).rejects.toThrow(/captain/i);
        });

        it('leaves a squad captainless rather than guessing one', async () => {
            const manager = managerFor('client-a');
            const players = affordableSquad(await manager.getState());

            const state = await manager.saveEntry({ teamName: 'No Armband', players });

            expect(state.myEntry.captain).toBeNull();
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

    describe('hidden squads', () => {
        /** The first match having a score is what locks editing — and reveals the squads. */
        const SCORED_FIRST_MATCH = {
            rounds: [[{ home: 'blue', away: 'white', homeScore: 2, awayScore: 1 }]]
        };

        /** Two squads that overlap except for one pick each, so a leak is identifiable. */
        async function enterTwoSquads() {
            const a = managerFor('client-a');
            const b = managerFor('client-b');
            const state = await a.getState();
            const cheap = [...state.market].sort((x, y) => x.price - y.price);
            const squadA = cheap.slice(0, state.squadSize).map((p) => p.playerName);
            const squadB = cheap.slice(1, state.squadSize + 1).map((p) => p.playerName);

            await a.saveEntry({ teamName: 'Team A', players: squadA, captain: squadA[0] });
            await b.saveEntry({ teamName: 'Team B', players: squadB, captain: squadB[0] });

            return { a, b, squadA, squadB, exclusiveToB: squadB[squadB.length - 1] };
        }

        it("keeps another manager's picks off the wire while squads can still be edited", async () => {
            const { a, exclusiveToB } = await enterTwoSquads();

            const state = await a.getState();
            expect(state.squadsRevealed).toBe(false);

            const theirs = state.entries.find((entry) => entry.teamName === 'Team B');
            expect(theirs.players).toEqual([]);
            expect(theirs.captain).toBeNull();
            expect(theirs.withdrawnPlayers).toEqual([]);
            // Concealed in the payload, not just in the page: the pick B alone made is
            // nowhere in the entries, however the client asks for them.
            expect(JSON.stringify(state.entries)).not.toContain(exclusiveToB);
        });

        it('leaves the leaderboard itself readable', async () => {
            const { a } = await enterTwoSquads();

            const theirs = (await a.getState()).entries.find(
                (entry) => entry.teamName === 'Team B'
            );
            expect(theirs.ownerName).toBeTruthy();
            expect(theirs.cost).toBeGreaterThan(0);
            expect(theirs.rank).toBeGreaterThan(0);
            expect(theirs.valid).toBe(true);
        });

        it('always shows a manager their own squad', async () => {
            const { a, squadA } = await enterTwoSquads();

            const state = await a.getState();
            expect(state.myEntry.players).toEqual(squadA);
            expect(state.myEntry.captain).toBe(squadA[0]);
            expect(state.entries.find((entry) => entry.isMine).players).toEqual(squadA);
        });

        it('reveals every squad once the first match has a score', async () => {
            const { squadB } = await enterTwoSquads();
            await writeSession({ games: SCORED_FIRST_MATCH });

            const state = await managerFor('client-a').getState();
            expect(state.squadsRevealed).toBe(true);

            const theirs = state.entries.find((entry) => entry.teamName === 'Team B');
            expect(theirs.players).toEqual(squadB);
            expect(theirs.captain).toBe(squadB[0]);
        });

        // An admin unlock hands the session back to its managers, so the squads go back
        // under wraps with it: whatever can still be edited can still be copied.
        it('hides them again for a session an admin has reopened', async () => {
            await writeLeagueInfo({
                registrationWindow: {
                    enabled: true,
                    startDayOffset: -2,
                    startTime: '07:30',
                    teamDrawDayOffset: -1,
                    teamDrawTime: '16:00',
                    endDayOffset: 0,
                    endTime: '12:00'
                }
            });
            await enterTwoSquads();

            vi.setSystemTime(new Date('2026-09-05T14:00:00'));
            const locked = await managerFor('client-a').getState();
            expect(locked.squadsRevealed).toBe(true);

            const unlocked = await managerFor('client-a', true).getState({
                adminUnlockDate: SESSION_DATE
            });
            expect(unlocked.windowState).toBe('open');
            expect(unlocked.squadsRevealed).toBe(false);
            expect(unlocked.entries.find((entry) => entry.teamName === 'Team B').players).toEqual(
                []
            );
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

        it('is pending before registration opens', async () => {
            await writeLeagueInfo({ registrationWindow: REGISTRATION_WINDOW });
            vi.useFakeTimers();
            // Registration opens 2026-09-03T07:30 for this session.
            vi.setSystemTime(new Date('2026-09-02T10:00:00'));

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('pending');
            expect(state.windowReason).toMatch(/opens when registration does/);
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

        // The squad lock, stated as a test: a score on the sheet ends every kind of edit,
        // including changing a squad that was entered in good time.
        it('refuses to change or withdraw a saved squad once a score is recorded', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'In Time', players });

            await writeSession({
                games: {
                    rounds: [[{ home: 'blue', away: 'white', homeScore: 0, awayScore: 0 }]]
                }
            });

            await expect(
                manager.saveEntry({ teamName: 'Second Thoughts', players })
            ).rejects.toThrow(/kicked off/);
            await expect(manager.deleteEntry()).rejects.toThrow(/kicked off/);

            // ...and the squad as entered is what stands.
            expect((await readStored()).entries[0].teamName).toBe('In Time');
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
            vi.setSystemTime(new Date('2026-09-02T10:00:00'));

            await expect(manager.saveEntry({ teamName: 'Early', players })).rejects.toThrow(
                /opens when registration does/
            );
        });

        it('is open from registration through to the first result', async () => {
            await writeLeagueInfo({ registrationWindow: REGISTRATION_WINDOW });
            vi.useFakeTimers();

            // Well before the team draw at 2026-09-04T16:00 — the old gate would have
            // called this pending, which is the whole point of the change.
            vi.setSystemTime(new Date('2026-09-03T08:00:00'));
            expect((await managerFor('client-a').getState()).windowState).toBe('open');

            vi.setSystemTime(new Date('2026-09-04T18:00:00'));
            expect((await managerFor('client-a').getState()).windowState).toBe('open');
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

        // Scores go in from the match tracker in whatever order the admin opens matches,
        // so a later round can be written down first. Football has still been played.
        it('closes on a score recorded out of order', async () => {
            await writeSession({
                games: {
                    rounds: [
                        [{ home: 'blue', away: 'white', homeScore: null, awayScore: null }],
                        [{ home: 'blue', away: 'green', homeScore: 2, awayScore: 1 }]
                    ]
                }
            });

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('closed');
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

    describe('live market', () => {
        /** The first match having a score is what closes the window. */
        const SCORED_FIRST_MATCH = {
            rounds: [[{ home: 'blue', away: 'white', homeScore: 2, awayScore: 1 }]]
        };

        /** @param {Object} state */
        function cheapestSquad(state) {
            return [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
        }

        it('freezes the market when the window closes, and only once', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            await manager.saveEntry({ teamName: 'In Time', players: cheapestSquad(before) });
            expect((await readStored()).board).toBeNull();

            await writeSession({ games: SCORED_FIRST_MATCH });

            const closed = await manager.getState();
            expect(closed.windowState).toBe('closed');
            expect(closed.locked).toBe(true);

            const frozen = await readStored();
            expect(frozen.board.lockedAt).toBeTruthy();

            // Registration is still legal after kick-off, but the market must not follow.
            await writeSession({
                games: SCORED_FIRST_MATCH,
                players: { available: [...POOL.map(([n]) => n), 'Latecomer'], waitingList: [] }
            });

            const after = await manager.getState();
            expect(after.market.map((p) => p.playerName)).not.toContain('Latecomer');
            expect(after.budget).toBe(closed.budget);
            expect((await readStored()).board.lockedAt).toBe(frozen.board.lockedAt);
        });

        it('freezes on demand, so the score that closes the window can pin the market', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            await manager.saveEntry({ teamName: 'Pinned', players: cheapestSquad(before) });

            // Still open: nothing to freeze yet.
            expect(await manager.ensureBoardFrozen()).toBe(false);

            await writeSession({ games: SCORED_FIRST_MATCH });
            expect(await manager.ensureBoardFrozen()).toBe(true);
            expect((await readStored()).board.lockedAt).toBeTruthy();

            // Idempotent - the games route calls this on every score, not just the first.
            expect(await manager.ensureBoardFrozen()).toBe(false);
        });

        it('leaves no file behind for a closed session nobody entered', async () => {
            await writeSession({ games: SCORED_FIRST_MATCH });

            const state = await managerFor('client-a').getState();
            expect(state.windowState).toBe('closed');
            expect(state.locked).toBe(false);

            await expect(readStored()).rejects.toThrow();
        });

        it('writes one board even when two clients read at the same moment', async () => {
            const manager = managerFor('client-a');
            const before = await manager.getState();
            await manager.saveEntry({ teamName: 'Racer', players: cheapestSquad(before) });
            await writeSession({ games: SCORED_FIRST_MATCH });

            const [a, b] = await Promise.all([
                managerFor('client-a').getState(),
                managerFor('client-b').getState()
            ]);

            const stored = await readStored();
            expect(a.budget).toBe(stored.board.budget);
            expect(b.budget).toBe(stored.board.budget);
            expect(a.market.map((p) => p.price)).toEqual(b.market.map((p) => p.price));
        });

        it('reports a market too thin to buy a legal squad', async () => {
            // The budget is a fraction of the most expensive squadSize players, so a pool
            // of exactly squadSize can never afford its only possible squad.
            const thin = POOL.slice(0, 5).map(([n]) => n);
            await writeSession({ players: { available: thin, waitingList: [] } });

            const manager = managerFor('client-a');
            const state = await manager.getState();
            expect(state.marketReady).toBe(false);
            expect(state.marketNotice).toMatch(/Not enough players/);

            await expect(
                manager.saveEntry({ teamName: 'Too Soon', players: thin })
            ).rejects.toThrow(/Not enough players/);
        });

        it('is ready as soon as the pool can afford a squad', async () => {
            await writeSession({
                players: { available: POOL.slice(0, 6).map(([n]) => n), waitingList: [] }
            });

            const state = await managerFor('client-a').getState();
            expect(state.marketReady).toBe(true);
            expect(state.marketNotice).toBe('');
        });
    });

    describe('drifting out of budget', () => {
        /**
         * A session frozen with a market that one squad can afford and one cannot. Written
         * directly so the rule is tested on exact numbers rather than on price dynamics.
         * @param {Object} entries
         */
        async function writeFrozenSession(entries) {
            await fs.mkdir(path.join(DATA_PATH, 'fantasy'), { recursive: true });
            await fs.writeFile(
                path.join(DATA_PATH, 'fantasy', `${SESSION_DATE}.json`),
                JSON.stringify(
                    {
                        date: SESSION_DATE,
                        board: {
                            lockedAt: '2026-09-05T08:00:00.000Z',
                            asOf: '2026-08-01',
                            regime: ['goals', 'offActions', 'defActions', 'saveActions'],
                            budget: 24,
                            squadSize: 5,
                            prices: {
                                Ace: 12,
                                Bruno: 10,
                                Cass: 8,
                                Dee: 6,
                                Eli: 4,
                                Fin: 4,
                                Gus: 4,
                                Hana: 4,
                                Ines: 4,
                                Jonah: 4
                            },
                            meta: {}
                        },
                        entries,
                        results: null
                    },
                    null,
                    2
                )
            );
        }

        const AFFORDABLE = ['Fin', 'Gus', 'Hana', 'Ines', 'Jonah']; // 20 of a 24 budget
        const OVER_BUDGET = ['Ace', 'Bruno', 'Cass', 'Dee', 'Eli']; // 40 of a 24 budget

        /** @param {string} clientId @param {string} teamName @param {string[]} players */
        function entryFor(clientId, teamName, players) {
            return {
                owner: ownerIdFor(clientId),
                ownerName: null,
                teamName,
                players,
                cost: 20,
                points: null,
                createdAt: '2026-09-04T08:00:00.000Z',
                updatedAt: '2026-09-04T08:00:00.000Z'
            };
        }

        it('flags a squad the market has priced out of budget', async () => {
            await writeFrozenSession([entryFor('client-a', 'Priced Out', OVER_BUDGET)]);

            const state = await managerFor('client-a').getState();
            expect(state.myEntry.valid).toBe(false);
            expect(state.myEntry.cost).toBe(40);
            expect(state.myEntry.invalidReason).toMatch(/costs 40, over the 24 budget/);
            // Not a rank at all - it is not in the running.
            expect(state.myEntry.rank).toBeNull();
        });

        it('does not score an invalid squad, and ranks it below every valid one', async () => {
            await writeFrozenSession([
                entryFor('client-a', 'Priced Out', OVER_BUDGET),
                entryFor('client-b', 'Legal', AFFORDABLE)
            ]);

            const rankings = buildRankings(HISTORY_DATES);
            rankings.calculatedDates.push(SESSION_DATE);
            for (const [name] of POOL) {
                rankings.players[name].history[SESSION_DATE] = {
                    points: { match: 3, knockout: 0 },
                    stats: { goals: 2, offActions: 0, defActions: 0, saveActions: 0 },
                    ratings: { elo: 1200 },
                    performance: { leagueWinner: false, cupWinner: false }
                };
            }
            await fs.writeFile(
                path.join(DATA_PATH, 'rankings-2026.json'),
                JSON.stringify(rankings, null, 2)
            );

            const state = await managerFor('client-a').getState();
            expect(state.settled).toBe(true);

            // The expensive squad would have won outright had it been legal.
            expect(state.entries[0].teamName).toBe('Legal');
            expect(state.entries[0].rank).toBe(1);
            expect(state.entries[0].points).toBeGreaterThan(0);

            expect(state.entries[1].teamName).toBe('Priced Out');
            expect(state.entries[1].points).toBeNull();
            expect(state.entries[1].rank).toBeNull();

            // And the null is persisted, not just presented.
            expect(
                (await readStored()).entries.find((e) => e.teamName === 'Priced Out').points
            ).toBeNull();
        });

        it('keeps a squad legal when a pick withdraws rather than when prices move', async () => {
            await writeFrozenSession([entryFor('client-a', 'Short Handed', AFFORDABLE)]);
            await writeSession({
                players: {
                    available: POOL.map(([n]) => n).filter((n) => n !== 'Jonah'),
                    waitingList: []
                }
            });

            const state = await managerFor('client-a').getState();
            // Jonah is still on the frozen board, so he still costs — withdrawal only
            // stops him scoring, and it is reported the same way as on a live board.
            expect(state.myEntry.valid).toBe(true);
            expect(state.myEntry.cost).toBe(20);
            expect(state.myEntry.withdrawnPlayers).toEqual(['Jonah']);
            expect(state.market.find((p) => p.playerName === 'Jonah').withdrawn).toBe(true);
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

        it("doubles the captain's points in the squad total", async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'Skippered', players, captain: players[0] });

            await settleWith(Object.fromEntries(players.map((name) => [name, 1])));

            // Every pick scores 7.5; the captain is counted a second time.
            const after = await manager.getState();
            expect(after.myEntry.points).toBeCloseTo((players.length + 1) * 7.5, 5);
            expect(after.myEntry.captain).toBe(players[0]);
        });

        it('doubles nothing for a captain who did not play', async () => {
            const manager = managerFor('client-a');
            const state = await manager.getState();
            const players = [...state.market]
                .sort((a, b) => a.price - b.price)
                .slice(0, state.squadSize)
                .map((p) => p.playerName);
            await manager.saveEntry({ teamName: 'Absent Skipper', players, captain: players[0] });

            const attended = players.slice(1);
            await settleWith(Object.fromEntries(attended.map((name) => [name, 1])));

            const after = await manager.getState();
            expect(after.myEntry.points).toBeCloseTo(attended.length * 7.5, 5);
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
