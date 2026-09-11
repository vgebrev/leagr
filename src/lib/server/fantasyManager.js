import path from 'path';
import fs from 'fs/promises';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';
import { data } from './data.js';
import { createRankingsManager } from './rankings.js';
import { createAvatarManager } from './avatarManager.js';
import { getConsolidatedSettings } from './settings.js';
import {
    buildWeeklyPrices,
    resolveFantasyConfig,
    sessionActuals,
    DEFAULT_FANTASY_CONFIG
} from './fantasyPricing.js';
import { hasSessionStarted, isCompetitionEnded, isRegistrationOpen } from '$lib/shared/helpers.js';
import { validateFantasyTeamName } from '$lib/shared/validation.js';

/** Shown for an entry whose owner has no registered player in the session. */
export const ANONYMOUS_OWNER = 'Anonymous';

/** Mutexes keyed by resolved file path, so concurrent entries never clobber each other. */
const fantasyMutexes = new Map();

/**
 * Custom error class for fantasy operations.
 *
 * Note the 401 default rather than 403: the client's handleAuthError treats 403 as
 * "the league access code is bad" and logs the user out, so an ownership or lock
 * failure must not use it.
 */
export class FantasyError extends Error {
    /**
     * @param {string} message
     * @param {number} statusCode
     */
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'FantasyError';
        this.statusCode = statusCode;
    }
}

/**
 * @typedef {Object} FantasyEntry
 * @property {string} owner - HMAC client hash; never leaves the server
 * @property {string|null} ownerName - the owner's own registered player, resolved at save time
 * @property {string} teamName
 * @property {string[]} players
 * @property {string|null} captain - one of `players`, scored twice; null for a squad with none
 * @property {number} cost
 * @property {number|null} points
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Weekly fantasy game: the squad store, its lock rules, and settlement.
 *
 * Pricing itself lives in the pure `fantasyPricing.js`; this class is the I/O half —
 * it loads what the engine needs, persists the frozen market and the entries, and
 * settles them once the session's rankings exist.
 */
export class FantasyManager {
    constructor() {
        this.leagueId = null;
        this.date = null;
        this.accessControl = null;
    }

    /**
     * @param {string} leagueId
     * @returns {FantasyManager}
     */
    setLeague(leagueId) {
        this.leagueId = leagueId;
        return this;
    }

    /**
     * @param {string} date - YYYY-MM-DD
     * @returns {FantasyManager}
     */
    setDate(date) {
        this.date = date;
        return this;
    }

    /**
     * @param {import('./playerAccessControl.js').PlayerAccessControl} accessControl
     * @returns {FantasyManager}
     */
    setAccessControl(accessControl) {
        this.accessControl = accessControl;
        return this;
    }

    /* ------------------------------------------------------------------ storage */

    /**
     * The session's fantasy file. Its own directory rather than a key on the daily
     * session file: `data.js` pins every filename to `<date>.json` in the league root,
     * so a subdirectory needs the manager-owned `fs` pattern that avatars and logos use.
     * @returns {string}
     */
    getFilePath() {
        if (!this.leagueId) throw new FantasyError('League ID must be set', 500);
        if (!this.date) throw new FantasyError('Date must be set', 500);
        return path.join(getLeagueDataPath(this.leagueId), 'fantasy', `${this.date}.json`);
    }

    /** @returns {Mutex} */
    getMutex() {
        const key = this.getFilePath();
        if (!fantasyMutexes.has(key)) {
            fantasyMutexes.set(key, new Mutex());
        }
        return fantasyMutexes.get(key);
    }

    /**
     * Read the stored session without mutex protection (internal use).
     * @returns {Promise<{date: string, board: Object|null, entries: FantasyEntry[], results: Object|null}>}
     */
    async #loadUnsafe() {
        const empty = { date: this.date, board: null, entries: [], results: null };
        try {
            const raw = await fs.readFile(this.getFilePath(), 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                date: parsed.date ?? this.date,
                board: parsed.board ?? null,
                entries: Array.isArray(parsed.entries) ? parsed.entries : [],
                results: parsed.results ?? null
            };
        } catch (err) {
            if (err.code === 'ENOENT') return empty;
            console.error('Error reading fantasy file:', err);
            return empty;
        }
    }

    /**
     * @param {{date: string, board: Object|null, entries: FantasyEntry[], results: Object|null}} state
     * @returns {Promise<void>}
     */
    async #saveUnsafe(state) {
        const filePath = this.getFilePath();
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(state, null, 2));
    }

    /* ------------------------------------------------------------------- context */

    /**
     * Everything the lock rules and the market need from the rest of the app.
     * @returns {Promise<{settings: Object, config: Object, players: Object, games: Object, playerOwners: Object, avatars: Object}>}
     */
    async #loadContext() {
        const [settings, players, games, playerOwners, avatars] = await Promise.all([
            getConsolidatedSettings(this.date, this.leagueId),
            data.get('players', this.date, this.leagueId),
            data.get('games', this.date, this.leagueId),
            data.get('playerOwners', this.date, this.leagueId),
            createAvatarManager().setLeague(this.leagueId).loadAvatars()
        ]);

        return {
            settings: settings ?? {},
            config: resolveFantasyConfig(settings),
            players: players ?? { available: [], waitingList: [] },
            games: games ?? {},
            playerOwners: playerOwners ?? {},
            avatars: avatars ?? {}
        };
    }

    /**
     * Where the session sits relative to the fantasy entry window.
     *
     * `pending` — registration has not opened, so there is no pool to price yet.
     * `open`    — the market is live and no match has produced a result yet.
     * `closed`  — a match has a score, or the competition has ended.
     *
     * The market deliberately tracks *registration*, not the team draw. Signups keep
     * moving until the competition ends — players register, withdraw and get reassigned
     * long after teams are drawn — so a draw-time gate locked the market on a moment
     * that settles nothing and shut out anyone who signed up later.
     * @param {Object} settings
     * @param {Object} games
     * @param {string|null} [adminUnlockDate]
     * @returns {{state: 'pending'|'open'|'closed', reason: string}}
     */
    getWindowState(settings, games, adminUnlockDate = null) {
        if (!isRegistrationOpen(this.date, settings)) {
            return {
                state: 'pending',
                reason: 'The fantasy market opens when registration does.'
            };
        }

        if (hasSessionStarted(games)) {
            return {
                state: 'closed',
                reason: 'The session has kicked off. Squads are locked.'
            };
        }

        const unlocked = adminUnlockDate && adminUnlockDate === this.date;
        if (!unlocked && isCompetitionEnded(this.date, settings)) {
            return { state: 'closed', reason: 'This session has ended. Squads are locked.' };
        }

        return { state: 'open', reason: '' };
    }

    /* -------------------------------------------------------------------- market */

    /**
     * Price the session's signup pool from rankings that predate it.
     *
     * `buildWeeklyPrices` is leak-free by construction — it only ever reads sessions
     * strictly before `date` — so this is safe to run for a past session too.
     * @param {Object} context - from #loadContext
     * @returns {Promise<{asOf: string|null, regime: string[], budget: number, squadSize: number, prices: Object[]}>}
     */
    async #buildBoard(context) {
        const year = Number(this.date.slice(0, 4));
        const rankingsManager = createRankingsManager().setLeague(this.leagueId);

        // Raw rankings, not the enhanced view: buildWeeklyPrices needs players[name].history,
        // which the enhanced/serialised paths strip.
        const [rankings, previous] = await Promise.all([
            rankingsManager.loadRankings(year),
            rankingsManager.loadRankings(year - 1)
        ]);

        const result = buildWeeklyPrices({
            players: rankings?.players ?? {},
            calculatedDates: rankings?.calculatedDates ?? [],
            pool: context.players?.available ?? [],
            date: this.date,
            previousYearPlayers: previous?.players ?? {},
            config: context.config
        });

        return {
            asOf: result.asOf ?? null,
            // The degenerate return omits `regime` detail but always carries the types.
            regime: result.regime ?? [],
            budget: result.budget ?? 0,
            squadSize: result.squadSize ?? context.config.squad.size,
            prices: result.prices ?? []
        };
    }

    /**
     * The board to price entries against: the frozen one once the window has closed,
     * otherwise a live board built from the current pool.
     *
     * While the window is open this is rebuilt on every read, so a late signup appears
     * immediately and prices move with the pool. A frozen board always wins — including
     * for an admin-unlocked session, which reopens editing but must not reprice a market
     * the session has already been judged on.
     * @param {Object} stored
     * @param {Object} context
     * @returns {Promise<{prices: Object[], budget: number, squadSize: number, asOf: string|null, regime: string[], locked: boolean}>}
     */
    async #resolveBoard(stored, context) {
        if (stored.board) {
            const prices = Object.entries(stored.board.prices ?? {}).map(([playerName, price]) => ({
                playerName,
                price,
                ...(stored.board.meta?.[playerName] ?? {})
            }));
            return {
                prices,
                budget: stored.board.budget ?? 0,
                squadSize: stored.board.squadSize ?? context.config.squad.size,
                asOf: stored.board.asOf ?? null,
                regime: stored.board.regime ?? [],
                locked: true
            };
        }

        const board = await this.#buildBoard(context);
        return { ...board, locked: false };
    }

    /**
     * Serialisable form of a live board, for freezing into the file.
     * @param {{asOf: string|null, regime: string[], budget: number, squadSize: number, prices: Object[]}} board
     */
    #freezeBoard(board) {
        /** @type {Record<string, number>} */
        const prices = {};
        /** @type {Record<string, Object>} */
        const meta = {};

        for (const entry of board.prices) {
            prices[entry.playerName] = entry.price;
            // Kept alongside the price so the market still renders years later, when the
            // rankings the prices came from may have been rebuilt.
            meta[entry.playerName] = {
                expectedPoints: entry.expectedPoints,
                provisional: entry.provisional,
                elo: entry.elo ?? null,
                sessions: entry.sessions
            };
        }

        return {
            lockedAt: new Date().toISOString(),
            asOf: board.asOf,
            regime: board.regime,
            budget: board.budget,
            squadSize: board.squadSize,
            prices,
            meta
        };
    }

    /**
     * Freeze the market, but only once the window has closed and only if there is
     * something to judge.
     *
     * Callers must already hold the mutex and pass the `stored` they read inside it —
     * that is what stops two simultaneous reads writing two different boards.
     * @param {{board: Object|null, entries: FantasyEntry[]}} stored
     * @param {Object} context
     * @param {{state: string}} window
     * @returns {Promise<Object|null>} the new board record, or null when nothing froze
     */
    async #freezeIfClosedUnsafe(stored, context, window) {
        if (stored.board) return null;
        if (window.state !== 'closed') return null;
        // No entries means nothing to judge, and freezing anyway would leave a file
        // behind for anyone who merely browsed the session.
        if (stored.entries.length === 0) return null;

        return this.#freezeBoard(await this.#buildBoard(context));
    }

    /**
     * Freeze the market for a closed session, if it is not frozen already.
     *
     * Public and identity-free so the moment the whistle goes — the score that closes
     * the window — can pin the market, rather than leaving it to whoever loads the page
     * next. Registration stays legal after kick-off, so a board built later could price
     * from a pool that grew during the match.
     * @param {{adminUnlockDate?: string|null}} [options]
     * @returns {Promise<boolean>} whether this call was the one that froze it
     */
    async ensureBoardFrozen(options = {}) {
        const context = await this.#loadContext();
        const window = this.getWindowState(
            context.settings,
            context.games,
            options.adminUnlockDate ?? null
        );
        if (window.state !== 'closed') return false;

        return await this.getMutex().runExclusive(async () => {
            const stored = await this.#loadUnsafe();
            const frozen = await this.#freezeIfClosedUnsafe(stored, context, window);
            if (!frozen) return false;

            await this.#saveUnsafe({ ...stored, date: this.date, board: frozen });
            return true;
        });
    }

    /* --------------------------------------------------------------- validity */

    /**
     * Re-price a stored squad against the board that currently applies.
     *
     * Derived, never stored: the board is the only moving input, so a re-frozen board or
     * a rankings rebuild flows through on the next read — the same self-correcting
     * property settlement already has.
     * @param {{players?: string[]}} entry
     * @param {{prices: Object[], budget: number}} board
     * @param {Set<string>} available - who is still signed up for the session
     * @returns {{cost: number, valid: boolean, invalidReason: string|null, withdrawnPlayers: string[]}}
     */
    #evaluateEntry(entry, board, available) {
        const priceOf = new Map(board.prices.map((price) => [price.playerName, price.price]));
        const players = entry.players ?? [];

        // A pick who is no longer signed up scores nothing. That is punishment enough —
        // a manager should not lose their week to someone else's withdrawal, so it never
        // invalidates the squad. Measured against the signup list rather than the board,
        // so it reads the same before and after the market freezes: a live board simply
        // drops them, a frozen one keeps their price.
        const withdrawnPlayers = players.filter((playerName) => !available.has(playerName));
        const cost =
            Math.round(
                players.reduce((sum, playerName) => sum + (priceOf.get(playerName) ?? 0), 0) * 2
            ) / 2;

        const budget = board.budget ?? 0;
        const valid = cost <= budget;

        return {
            cost,
            valid,
            invalidReason: valid ? null : `This squad costs ${cost}, over the ${budget} budget.`,
            withdrawnPlayers
        };
    }

    /**
     * Whether the pool can furnish a legal squad at all yet.
     *
     * Opening with registration means the first managers arrive to a pool too thin to
     * buy from: the budget is a fraction of what the most expensive `squadSize` players
     * cost, so a pool of exactly `squadSize` can never afford its only possible squad.
     * @param {{prices: Object[], budget: number, squadSize: number}} board
     * @returns {{ready: boolean, notice: string}}
     */
    #marketReadiness(board) {
        const squadSize = board.squadSize ?? 0;
        const cheapest = board.prices
            .map((price) => price.price)
            .sort((a, b) => a - b)
            .slice(0, squadSize);

        const ready =
            squadSize > 0 &&
            cheapest.length === squadSize &&
            Math.round(cheapest.reduce((sum, price) => sum + price, 0) * 2) / 2 <=
                (board.budget ?? 0);

        return {
            ready,
            notice: ready
                ? ''
                : 'Not enough players have signed up yet for a squad to fit the budget. Check back as more register.'
        };
    }

    /* ---------------------------------------------------------------- ownership */

    /**
     * @returns {string} the current client's owner hash for this session
     */
    #requireOwnerId() {
        const ownerId = this.accessControl?.deriveOwnerId();
        if (!ownerId) {
            throw new FantasyError('Could not identify you. Please reload and try again.', 400);
        }
        return ownerId;
    }

    /**
     * The manager's own registered player: the first name in `playerOwners` claimed by
     * the same client hash. Null when they have not registered anyone this session.
     * @param {Object} playerOwners
     * @param {string} ownerId
     * @returns {string|null}
     */
    #resolveOwnerName(playerOwners, ownerId) {
        const owned = Object.keys(playerOwners ?? {}).filter(
            (playerName) => playerOwners[playerName] === ownerId
        );
        return owned.length > 0 ? owned[0] : null;
    }

    /* --------------------------------------------------------------- settlement */

    /**
     * What each player in the session actually scored, once rankings know about the date.
     * @param {string[]} regime
     * @param {Object} config
     * @returns {Promise<Map<string, {total: number, breakdown: Object}>|null>} null when not yet settleable
     */
    async #computeActuals(regime, config) {
        const year = Number(this.date.slice(0, 4));
        const rankings = await createRankingsManager().setLeague(this.leagueId).loadRankings(year);

        // Rankings are rebuilt manually in this app, so a finished session stays unsettled
        // until someone runs the update. Absence of the date is the "not yet" signal.
        if (!rankings?.calculatedDates?.includes(this.date)) return null;

        const weights = config?.scoring ?? DEFAULT_FANTASY_CONFIG.scoring;
        const regimeTypes = regime?.length ? regime : undefined;
        return sessionActuals(rankings.players ?? {}, this.date, weights, regimeTypes);
    }

    /**
     * Score a squad against the session's actuals. A pick who did not play simply
     * contributes nothing — no refund, no adjustment.
     *
     * The captain is counted twice, which is also why nothing special happens when the
     * captain is absent or withdrawn: doubling nothing is still nothing.
     * @param {string[]} players
     * @param {Map<string, {total: number}>} actuals
     * @param {string|null} [captain]
     * @returns {number}
     */
    #scoreSquad(players, actuals, captain = null) {
        const total = players.reduce(
            (sum, playerName) => sum + (actuals.get(playerName)?.total ?? 0),
            0
        );
        const armband =
            captain && players.includes(captain) ? (actuals.get(captain)?.total ?? 0) : 0;
        return Math.round((total + armband) * 100) / 100;
    }

    /* -------------------------------------------------------------------- public */

    /**
     * The whole fantasy state for the session, from the calling client's point of view.
     * Settles the session as a side effect when rankings have caught up.
     * @param {{adminUnlockDate?: string|null}} [options]
     * @returns {Promise<Object>}
     */
    async getState(options = {}) {
        const context = await this.#loadContext();
        const mutex = this.getMutex();

        return await mutex.runExclusive(async () => {
            const stored = await this.#loadUnsafe();
            const window = this.getWindowState(
                context.settings,
                context.games,
                options.adminUnlockDate ?? null
            );

            // Freeze here rather than on the first entry, which is what lets the market
            // stay live all week. Inside the mutex, on a `stored` read inside it, so two
            // simultaneous reads can never write two different boards.
            const frozen = await this.#freezeIfClosedUnsafe(stored, context, window);
            const boardRecord = frozen ?? stored.board;
            const board = await this.#resolveBoard({ ...stored, board: boardRecord }, context);

            let dirty = Boolean(frozen);
            const availableNow = new Set(context.players?.available ?? []);

            // Settle whenever rankings can answer, so a corrected score flows through on
            // the next load rather than being frozen at first settlement.
            let results = stored.results;
            let entries = stored.entries;
            let settled = false;

            const actuals = await this.#computeActuals(board.regime, context.config);
            if (actuals) {
                settled = true;
                const playerPoints = Object.fromEntries(actuals);
                entries = entries.map((entry) => ({
                    ...entry,
                    // An invalid squad is not scored at all — it stays null, the same as
                    // an unsettled one, and the payload says why.
                    points: this.#evaluateEntry(entry, board, availableNow).valid
                        ? this.#scoreSquad(entry.players, actuals, entry.captain ?? null)
                        : null
                }));

                const changed =
                    JSON.stringify(stored.results?.playerPoints ?? null) !==
                        JSON.stringify(playerPoints) ||
                    JSON.stringify(stored.entries.map((e) => e.points)) !==
                        JSON.stringify(entries.map((e) => e.points));

                results = { settledAt: new Date().toISOString(), playerPoints };

                if (changed && (boardRecord || entries.length > 0)) dirty = true;
            }

            if (dirty) {
                await this.#saveUnsafe({
                    date: this.date,
                    board: boardRecord,
                    entries,
                    results
                });
            }

            return this.#present({ context, board, window, entries, results, settled });
        });
    }

    /**
     * Create or replace the calling client's squad.
     * @param {{teamName: string, players: string[], captain?: string|null}} submission
     * @param {{adminUnlockDate?: string|null}} [options]
     * @returns {Promise<Object>} the same shape as getState()
     */
    async saveEntry(submission, options = {}) {
        const ownerId = this.#requireOwnerId();
        const context = await this.#loadContext();

        const window = this.getWindowState(
            context.settings,
            context.games,
            options.adminUnlockDate ?? null
        );
        if (window.state !== 'open') {
            // 400, not 403: the client treats 403 as a bad league access code and logs the
            // user out, and games/+server.js already answers a closed competition with 400.
            throw new FantasyError(window.reason, 400);
        }

        const nameValidation = validateFantasyTeamName(submission?.teamName);
        if (!nameValidation.isValid) {
            throw new FantasyError(nameValidation.errors[0], 400);
        }
        const teamName = nameValidation.sanitizedName;

        const mutex = this.getMutex();
        return await mutex.runExclusive(async () => {
            const stored = await this.#loadUnsafe();

            // Priced against the live market rather than a frozen one: the pool moves
            // all week, so the market a manager is looking at is the market they buy in.
            // A board only exists here for a session that closed and was reopened by an
            // admin unlock, and it stays authoritative in that case.
            const board = await this.#resolveBoard(stored, context);

            const readiness = this.#marketReadiness(board);
            if (!readiness.ready) {
                throw new FantasyError(readiness.notice, 400);
            }

            const priceOf = Object.fromEntries(
                board.prices.map((price) => [price.playerName, price.price])
            );
            const squadSize = board.squadSize ?? context.config.squad.size;
            const budget = board.budget ?? 0;

            const players = Array.isArray(submission?.players) ? submission.players : null;
            if (!players) {
                throw new FantasyError('A squad must be a list of players.', 400);
            }
            if (players.length !== squadSize) {
                throw new FantasyError(`A squad must have exactly ${squadSize} players.`, 400);
            }
            if (new Set(players).size !== players.length) {
                throw new FantasyError('A squad cannot contain the same player twice.', 400);
            }

            const unpriced = players.filter((playerName) => !(playerName in priceOf));
            if (unpriced.length > 0) {
                throw new FantasyError(
                    `Not available in this week's market: ${unpriced.join(', ')}.`,
                    400
                );
            }

            const cost = Math.round(players.reduce((sum, p) => sum + priceOf[p], 0) * 2) / 2;
            if (cost > budget) {
                throw new FantasyError(
                    `That squad costs ${cost}, over your ${budget} budget.`,
                    400
                );
            }

            // Optional, not required: a squad saved before there were captains still scores,
            // and one saved without one simply doubles nobody.
            const captain = submission?.captain ?? null;
            if (captain !== null && !players.includes(captain)) {
                throw new FantasyError('Your captain must be one of your picks.', 400);
            }

            const now = new Date().toISOString();
            const ownerName = this.#resolveOwnerName(context.playerOwners, ownerId);
            const existingIndex = stored.entries.findIndex((entry) => entry.owner === ownerId);

            /** @type {FantasyEntry} */
            const entry = {
                owner: ownerId,
                ownerName,
                teamName,
                players: [...players],
                captain,
                cost,
                points: null,
                createdAt: stored.entries[existingIndex]?.createdAt ?? now,
                updatedAt: now
            };

            const entries = [...stored.entries];
            if (existingIndex >= 0) {
                entries[existingIndex] = entry;
            } else {
                entries.push(entry);
            }

            await this.#saveUnsafe({
                date: this.date,
                board: stored.board,
                entries,
                results: stored.results
            });

            return this.#present({
                context,
                board,
                window,
                entries,
                results: stored.results,
                settled: false
            });
        });
    }

    /**
     * Withdraw the calling client's squad.
     * @param {{adminUnlockDate?: string|null}} [options]
     * @returns {Promise<Object>} the same shape as getState()
     */
    async deleteEntry(options = {}) {
        const ownerId = this.#requireOwnerId();
        const context = await this.#loadContext();

        const window = this.getWindowState(
            context.settings,
            context.games,
            options.adminUnlockDate ?? null
        );
        if (window.state !== 'open') {
            // 400, not 403: the client treats 403 as a bad league access code and logs the
            // user out, and games/+server.js already answers a closed competition with 400.
            throw new FantasyError(window.reason, 400);
        }

        const mutex = this.getMutex();
        return await mutex.runExclusive(async () => {
            const stored = await this.#loadUnsafe();
            const entries = stored.entries.filter((entry) => entry.owner !== ownerId);

            if (entries.length === stored.entries.length) {
                throw new FantasyError('You do not have a squad for this session.', 404);
            }

            await this.#saveUnsafe({ ...stored, date: this.date, entries });

            const board = await this.#resolveBoard(stored, context);
            return this.#present({
                context,
                board,
                window,
                entries,
                results: stored.results,
                settled: false
            });
        });
    }

    /* ------------------------------------------------------------- presentation */

    /**
     * Shape the state for the API. Owner hashes never cross this boundary — a row is
     * identified to the client only by `isMine` and the owner's player name — and neither
     * do other managers' picks until editing locks.
     * @returns {Object}
     */
    #present({ context, board, window, entries, results, settled }) {
        const ownerId = this.accessControl?.deriveOwnerId() ?? null;
        const available = new Set(context.players?.available ?? []);
        const playerPoints = results?.playerPoints ?? {};
        const avatars = context.avatars ?? {};

        const market = board.prices
            .map((price) => ({
                playerName: price.playerName,
                price: price.price,
                expectedPoints: price.expectedPoints ?? null,
                provisional: Boolean(price.provisional),
                elo: price.elo ?? null,
                avatar: avatars[price.playerName]?.avatar ?? null,
                // Priced into the frozen market but no longer signed up. Their picks
                // score nothing; the UI flags them rather than forcing a swap.
                withdrawn: board.locked && !available.has(price.playerName),
                points: playerPoints[price.playerName]?.total ?? null
            }))
            .sort((a, b) => b.price - a.price || a.playerName.localeCompare(b.playerName));

        // A squad is only worth picking if it is your own work, so while there is still
        // time to copy one, every squad but yours is a name, a cost and a rank. It is cut
        // out of the payload rather than hidden in the page — the API is the easier read.
        // Tied to the edit lock, so an admin unlock puts them back under wraps too.
        const squadsRevealed = window.state === 'closed';

        let validRank = 0;
        const presented = entries
            .map((entry) => {
                const evaluated = this.#evaluateEntry(entry, board, available);
                return {
                    teamName: entry.teamName,
                    // Re-resolved live so a rename follows through, with the stored name as
                    // the fallback for an owner who has since deregistered.
                    ownerName:
                        this.#resolveOwnerName(context.playerOwners, entry.owner) ??
                        entry.ownerName ??
                        ANONYMOUS_OWNER,
                    players: [...entry.players],
                    // Scored twice at settlement, and badged on the pitch. Null for a squad
                    // entered before captains existed, or one saved without picking one.
                    captain: entry.captain ?? null,
                    // The live cost, not the one at save time: prices move with the pool,
                    // and the number a squad is judged on has to be the one that applies now.
                    cost: evaluated.cost,
                    valid: evaluated.valid,
                    invalidReason: evaluated.invalidReason,
                    withdrawnPlayers: evaluated.withdrawnPlayers,
                    points: entry.points ?? null,
                    isMine: Boolean(ownerId) && entry.owner === ownerId,
                    updatedAt: entry.updatedAt
                };
            })
            .sort((a, b) => {
                // An invalid squad is never scored, so it never places above one that is.
                if (a.valid !== b.valid) return a.valid ? -1 : 1;
                if (settled) return (b.points ?? 0) - (a.points ?? 0);
                return String(a.updatedAt).localeCompare(String(b.updatedAt));
            })
            .map((entry) => {
                const ranked = { ...entry, rank: entry.valid ? ++validRank : null };
                if (squadsRevealed || ranked.isMine) return ranked;
                return { ...ranked, players: [], captain: null, withdrawnPlayers: [] };
            });

        const mine = presented.find((entry) => entry.isMine) ?? null;
        const readiness = this.#marketReadiness(board);

        return {
            date: this.date,
            squadSize: board.squadSize,
            budget: board.budget,
            asOf: board.asOf,
            locked: board.locked,
            squadsRevealed,
            // The rules the session is judged by, for the screen that explains them: both
            // are league-tunable, and the regime decides which stats are paid for at all.
            scoring: { ...context.config.scoring },
            statTypes: [...board.regime],
            marketReady: readiness.ready,
            marketNotice: readiness.notice,
            windowState: window.state,
            windowReason: window.reason,
            settled,
            settleHint:
                !settled && window.state === 'closed'
                    ? 'Scores appear once the session rankings have been updated.'
                    : '',
            market,
            entries: presented,
            myEntry: mine
        };
    }
}

/**
 * @returns {FantasyManager}
 */
export const createFantasyManager = () => new FantasyManager();
