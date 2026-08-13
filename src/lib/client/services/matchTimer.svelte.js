/**
 * Match Centre game timer.
 *
 * Device-local by design: whoever referees runs the clock on their own phone.
 * Nothing here is written to match data — the only server-side state involved is
 * the league's default game length.
 *
 * Elapsed time is derived from an absolute epoch anchor, never accumulated from
 * ticks. Mobile browsers clamp background intervals to >=1s or suspend them
 * entirely, so a tick-counting clock would drift badly on exactly the device
 * this targets. The interval's only job is to refresh `now` so derived values
 * recompute; when the tab wakes, `now` jumps to the truth and the clock is
 * instantly correct again.
 */
import { unlockAudio, playWhistle, vibrate } from './whistle.js';

const STORAGE_KEY = 'leagr:matchTimer';
const MUTE_KEY = 'leagr:matchTimerMuted';
const EXPANDED_KEY = 'leagr:matchTimerExpanded';
const TICK_MS = 250;
const COUNTDOWN_MS = 3000;
const MIN_MINUTES = 1;
const MAX_MINUTES = 60;

/** A stored clock older than this belongs to a session that is long over. */
const MAX_CLOCK_AGE_MS = 12 * 60 * 60 * 1000;
/** Comfortably more matches than a session has, so nothing in play is evicted. */
const MAX_STORED_CLOCKS = 12;

const SHORT_BUZZ = [120];
const LONG_BUZZ = [400, 120, 400, 120, 600];

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

class MatchTimerService {
    /** @type {string|null} Identifies the match this clock belongs to */
    matchKey = $state(null);
    /** @type {number} Regulation time in milliseconds */
    durationMs = $state(0);
    /** @type {number} Last play allowance in milliseconds; 0 when the rule is off */
    lastPlayMs = $state(0);
    /** @type {number} Run time banked before the current run */
    accumulatedMs = $state(0);
    /** @type {number|null} Absolute epoch ms the current run began; null when not running */
    runStartedAt = $state(null);
    /** @type {'idle'|'countdown'|'running'|'paused'|'finished'} */
    status = $state('idle');
    /** @type {number} Remaining whole seconds of the kick-off countdown */
    countdownValue = $state(0);
    /** @type {number|null} Absolute epoch ms the countdown began */
    countdownStartedAt = $state(null);
    /** @type {boolean} Whether the full time signal has already fired this run */
    regulationSignalled = $state(false);
    /** @type {boolean} Audio suppressed (haptics still fire) */
    muted = $state(false);
    /**
     * @type {boolean} Timer panel showing its full controls rather than the
     * compact row. A view preference rather than clock state, kept here so that
     * every per-device timer preference persists the same way and survives
     * navigating between matches.
     */
    expanded = $state(false);
    /** @type {number} Refreshed by the tick interval so derived values recompute */
    now = $state(0);

    /** @type {ReturnType<typeof setInterval>|null} */
    #interval = null;
    /** @type {any} */
    #wakeLock = null;
    /** @type {(() => void)|null} */
    #visibilityListener = null;

    constructor() {
        this.now = Date.now();
        this.muted = this.#readFlag(MUTE_KEY);
        this.expanded = this.#readFlag(EXPANDED_KEY);
    }

    /** Total run time, anchored to the wall clock rather than accumulated from ticks */
    elapsedMs = $derived(
        this.accumulatedMs + (this.runStartedAt === null ? 0 : this.now - this.runStartedAt)
    );

    /** The point at which play must stop regardless of what the referee does */
    hardStopMs = $derived(this.durationMs + this.lastPlayMs);

    /**
     * Derived from the clock rather than stored as a status, which keeps pause,
     * resume, anchoring and persistence identical in both phases.
     * @type {'regulation'|'lastPlay'}
     */
    phase = $derived(this.elapsedMs < this.durationMs ? 'regulation' : 'lastPlay');

    /** Time left in the current phase */
    remainingMs = $derived(
        Math.max(
            0,
            (this.phase === 'regulation' ? this.durationMs : this.hardStopMs) - this.elapsedMs
        )
    );

    /** True only while last play is actually being played */
    isLastPlay = $derived(
        this.phase === 'lastPlay' &&
            this.lastPlayMs > 0 &&
            (this.status === 'running' || this.status === 'paused')
    );

    /** Fraction of the whole match played, for the progress bar */
    progress = $derived(this.hardStopMs > 0 ? clamp(this.elapsedMs / this.hardStopMs, 0, 1) : 0);

    isRunning = $derived(this.status === 'running');
    isActive = $derived(this.status !== 'idle');
    durationMinutes = $derived(Math.round(this.durationMs / 60_000));

    /**
     * Bind the clock to a match. Re-attaching the same match is a no-op beyond
     * re-establishing the tick, so the effect that calls this can run freely.
     *
     * Every match keeps its own stored clock, so moving to another match banks
     * this one rather than discarding it: only the referee resets a clock.
     * @param {string|null} matchKey - `${date}:${competition}:${round}:${match}`
     * @param {{durationMinutes?: number, lastPlaySeconds?: number}} [options] - League settings
     */
    attach(matchKey, options = {}) {
        if (!matchKey) return;

        if (this.matchKey === matchKey) {
            this.#ensureTicking();
            this.#watchVisibility();
            return;
        }

        this.#stopTicking();
        this.#releaseWakeLock();

        const snapshot = this.#readSnapshot(matchKey);
        if (snapshot) {
            this.#restore(matchKey, snapshot);
            return;
        }

        const { durationMinutes = 8, lastPlaySeconds = 0 } = options;
        this.matchKey = matchKey;
        this.durationMs =
            clamp(Math.round(durationMinutes) || 1, MIN_MINUTES, MAX_MINUTES) * 60_000;
        this.lastPlayMs = Math.max(0, Math.round(lastPlaySeconds)) * 1000;
        this.accumulatedMs = 0;
        this.runStartedAt = null;
        this.countdownStartedAt = null;
        this.countdownValue = 0;
        this.regulationSignalled = false;
        this.status = 'idle';
        this.now = Date.now();
        this.#watchVisibility();
        this.#persist();
    }

    /**
     * Stop driving the clock without discarding it; the snapshot is left in place.
     *
     * A live clock is left running: it belongs to a game in progress, so full
     * time has to sound wherever in the app the referee happens to be.
     */
    detach() {
        if (this.isRunning || this.status === 'countdown') return;
        this.destroy();
    }

    /** Begin the kick-off countdown. Must be called from a user gesture. */
    start() {
        if (this.status !== 'idle') return;

        // Inside the gesture, so this unlock covers every later signal.
        unlockAudio();
        this.#requestWakeLock();

        this.now = Date.now();
        this.countdownStartedAt = this.now;
        this.countdownValue = Math.ceil(COUNTDOWN_MS / 1000);
        this.status = 'countdown';
        this.#ensureTicking();
        this.#persist();
    }

    /**
     * Start the clock for a game that is already under way — no countdown, no
     * kick-off whistle. Triggered when a stat is recorded before anyone started
     * the timer: play is demonstrably in progress, so counting down to a
     * kick-off would announce something that has already happened.
     *
     * The clock will read late by however long it took to record that first
     * stat. That is the deliberate trade: an approximate clock beats none.
     * Must be called from a user gesture so the audio unlock still takes.
     */
    startLate() {
        if (this.status !== 'idle') return;

        unlockAudio();
        this.#requestWakeLock();

        this.now = Date.now();
        this.runStartedAt = this.now;
        this.countdownStartedAt = null;
        this.countdownValue = 0;
        this.status = 'running';
        this.#ensureTicking();
        this.#watchVisibility();
        this.#persist();
    }

    pause() {
        if (this.status !== 'running') return;

        this.accumulatedMs = this.elapsedMs;
        this.runStartedAt = null;
        this.status = 'paused';
        this.#stopTicking();
        this.#releaseWakeLock();
        this.#persist();
    }

    /**
     * Restart play after a stoppage: no countdown, and no whistle.
     *
     * A restart blast is indistinguishable from a kick-off or a full time
     * signal to everyone on the pitch, so it reads as confusion rather than
     * information. Only three moments are announced: kick-off, last play, and
     * the end of the match. The buzz stays as confirmation the tap took.
     */
    resume() {
        if (this.status !== 'paused') return;

        unlockAudio();
        this.#requestWakeLock();
        this.now = Date.now();
        this.runStartedAt = this.now;
        this.status = 'running';
        vibrate(SHORT_BUZZ);
        this.#ensureTicking();
        this.#persist();
    }

    /**
     * Adjust the game length, including mid-run — the cup final is 10 minutes
     * while everything else is 8.
     * @param {number} deltaMinutes - Minutes to add or remove
     */
    adjustDuration(deltaMinutes) {
        const next = clamp(this.durationMinutes + deltaMinutes, MIN_MINUTES, MAX_MINUTES);
        if (next * 60_000 === this.durationMs) return;

        this.durationMs = next * 60_000;
        this.#checkThresholds();
        this.#persist();
    }

    /** The referee's tap for a goal scored or possession changed. */
    endLastPlay() {
        if (!this.isLastPlay) return;
        this.#finish();
    }

    /** Back to the start, keeping whatever duration is currently set. */
    reset() {
        if (!this.isActive) return;

        this.#stopTicking();
        this.#releaseWakeLock();
        this.accumulatedMs = 0;
        this.runStartedAt = null;
        this.countdownStartedAt = null;
        this.countdownValue = 0;
        this.regulationSignalled = false;
        this.status = 'idle';
        this.now = Date.now();
        this.#persist();
    }

    /**
     * @param {boolean} muted - Suppress audio; haptics continue either way
     */
    setMuted(muted) {
        this.muted = muted;
        this.#storeFlag(MUTE_KEY, muted);
    }

    toggleMute() {
        this.setMuted(!this.muted);
    }

    /**
     * @param {boolean} expanded - Show the full control set rather than the compact row
     */
    setExpanded(expanded) {
        this.expanded = expanded;
        this.#storeFlag(EXPANDED_KEY, expanded);
    }

    toggleExpanded() {
        this.setExpanded(!this.expanded);
    }

    /** Tear down everything, including listeners, live clock or not. */
    destroy() {
        this.#stopTicking();
        this.#releaseWakeLock();
        this.#unwatchVisibility();
    }

    // -- internals -------------------------------------------------------

    #tick() {
        this.now = Date.now();

        if (this.status === 'countdown') {
            const remaining = COUNTDOWN_MS - (this.now - (this.countdownStartedAt ?? this.now));
            this.countdownValue = Math.max(0, Math.ceil(remaining / 1000));
            if (remaining <= 0) this.#beginPlay();
            return;
        }

        this.#checkThresholds();
    }

    #beginPlay() {
        this.runStartedAt = this.now;
        this.countdownStartedAt = null;
        this.countdownValue = 0;
        this.status = 'running';
        this.#signal(false);
        this.#persist();
    }

    /**
     * Full time and hard stop, each fired at most once per run.
     */
    #checkThresholds() {
        if (this.status !== 'running') return;

        if (this.elapsedMs < this.durationMs) {
            // The duration was raised back above the clock; re-arm full time.
            this.regulationSignalled = false;
            return;
        }

        if (this.elapsedMs >= this.hardStopMs) {
            // Blew through both thresholds while the tab was frozen. Mark full
            // time as consumed rather than replaying a whistle that would
            // announce a last play which is already over.
            this.regulationSignalled = true;
            this.#finish();
            return;
        }

        if (!this.regulationSignalled) {
            this.regulationSignalled = true;
            this.#signal(false);
            this.#persist();
        }
    }

    #finish() {
        if (this.status === 'finished') return;

        // Park the clock exactly on 0:00 so a finished timer always reads the same.
        this.accumulatedMs = this.hardStopMs;
        this.runStartedAt = null;
        this.status = 'finished';
        this.now = Date.now();
        this.#stopTicking();
        this.#releaseWakeLock();
        this.#signal(true);
        this.#persist();
    }

    /**
     * @param {boolean} long - Long signals the end of play; short means play continues
     */
    #signal(long) {
        if (!this.muted) playWhistle({ long });
        vibrate(long ? LONG_BUZZ : SHORT_BUZZ);
    }

    #ensureTicking() {
        if (this.#interval !== null) return;
        if (this.status !== 'running' && this.status !== 'countdown') return;
        if (typeof window === 'undefined') return;

        this.#interval = setInterval(() => this.#tick(), TICK_MS);
    }

    #stopTicking() {
        if (this.#interval === null) return;
        clearInterval(this.#interval);
        this.#interval = null;
    }

    // -- wake lock -------------------------------------------------------

    #requestWakeLock() {
        if (typeof navigator === 'undefined') return;
        const wakeLock = /** @type {any} */ (navigator).wakeLock;
        if (!wakeLock?.request) return;

        try {
            wakeLock
                .request('screen')
                .then((/** @type {any} */ lock) => {
                    this.#wakeLock = lock;
                })
                .catch(() => {
                    // Denied (often because the page is hidden) - the clock is unaffected.
                });
        } catch {
            // Unsupported; nothing to do.
        }
    }

    #releaseWakeLock() {
        if (!this.#wakeLock) return;
        try {
            this.#wakeLock.release?.();
        } catch {
            // Already gone.
        }
        this.#wakeLock = null;
    }

    // -- visibility ------------------------------------------------------

    #watchVisibility() {
        if (typeof document === 'undefined' || this.#visibilityListener) return;

        this.#visibilityListener = () => {
            if (document.visibilityState !== 'visible') return;

            // Catch up immediately rather than showing a stale second, and fire a
            // late whistle if play ran out while we were hidden.
            this.now = Date.now();
            if (this.status === 'running') {
                this.#checkThresholds();
                this.#requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', this.#visibilityListener);
    }

    #unwatchVisibility() {
        if (typeof document === 'undefined' || !this.#visibilityListener) return;
        document.removeEventListener('visibilitychange', this.#visibilityListener);
        this.#visibilityListener = null;
    }

    // -- persistence -----------------------------------------------------

    /**
     * Every match's clock, keyed by match key.
     * @returns {Record<string, any>}
     */
    #readAll() {
        if (typeof window === 'undefined') return {};
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || typeof parsed !== 'object') return {};

            // Clocks were once stored one at a time, with the key inside the
            // record. Carry that one over rather than dropping a live game.
            if (typeof parsed.matchKey === 'string') {
                return { [parsed.matchKey]: { ...parsed, updatedAt: Date.now() } };
            }
            return parsed;
        } catch (error) {
            console.error('Error reading timer state from localStorage:', error);
            return {};
        }
    }

    /**
     * @param {string} matchKey
     * @returns {any|null}
     */
    #readSnapshot(matchKey) {
        const entry = this.#readAll()[matchKey];
        if (!entry || typeof entry !== 'object') return null;
        return Date.now() - (entry.updatedAt ?? 0) > MAX_CLOCK_AGE_MS ? null : entry;
    }

    #persist() {
        if (typeof window === 'undefined' || !this.matchKey) return;
        try {
            const clocks = this.#readAll();
            clocks[this.matchKey] = {
                durationMs: this.durationMs,
                lastPlayMs: this.lastPlayMs,
                accumulatedMs: this.accumulatedMs,
                runStartedAt: this.runStartedAt,
                status: this.status,
                regulationSignalled: this.regulationSignalled,
                updatedAt: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#prune(clocks)));
        } catch (error) {
            console.error('Error storing timer state in localStorage:', error);
        }
    }

    /**
     * Keep storage to this session: anything from an older one is gone, and the
     * rest is capped most-recent-first. The match being played is never dropped,
     * however many others are stored.
     * @param {Record<string, any>} clocks
     * @returns {Record<string, any>}
     */
    #prune(clocks) {
        const cutoff = Date.now() - MAX_CLOCK_AGE_MS;
        const kept = Object.entries(clocks)
            .filter(([key, entry]) => key === this.matchKey || (entry?.updatedAt ?? 0) > cutoff)
            .sort(([keyA, a], [keyB, b]) => {
                if (keyA === this.matchKey) return -1;
                if (keyB === this.matchKey) return 1;
                return (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0);
            });

        return Object.fromEntries(kept.slice(0, MAX_STORED_CLOCKS));
    }

    /**
     * @param {string} matchKey
     * @param {any} snapshot
     */
    #restore(matchKey, snapshot) {
        this.#stopTicking();
        this.matchKey = matchKey;
        this.durationMs = snapshot.durationMs ?? 0;
        this.lastPlayMs = snapshot.lastPlayMs ?? 0;
        this.accumulatedMs = snapshot.accumulatedMs ?? 0;
        this.runStartedAt = snapshot.runStartedAt ?? null;
        this.regulationSignalled = Boolean(snapshot.regulationSignalled);
        this.countdownStartedAt = null;
        this.countdownValue = 0;
        this.now = Date.now();

        // A countdown interrupted by a reload is not worth resuming mid-flight.
        this.status = snapshot.status === 'countdown' ? 'idle' : (snapshot.status ?? 'idle');
        if (this.status === 'idle') {
            this.accumulatedMs = 0;
            this.runStartedAt = null;
        }

        this.#watchVisibility();
        this.#ensureTicking();
        if (this.status === 'running') {
            this.#requestWakeLock();
            this.#checkThresholds();
        }
    }

    /**
     * Read a persisted device preference (mute, expanded).
     * @param {string} key
     * @returns {boolean}
     */
    #readFlag(key) {
        if (typeof window === 'undefined') return false;
        try {
            return localStorage.getItem(key) === 'true';
        } catch (error) {
            console.error('Error reading timer preference:', error);
            return false;
        }
    }

    /**
     * @param {string} key
     * @param {boolean} value
     */
    #storeFlag(key, value) {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(key, value ? 'true' : 'false');
        } catch (error) {
            console.error('Error storing timer preference:', error);
        }
    }
}

export const matchTimer = new MatchTimerService();

/**
 * Format a duration as m:ss.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Clock display
 */
export function formatClock(ms) {
    const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
