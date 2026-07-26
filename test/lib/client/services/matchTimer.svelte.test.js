import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The whistle module is stubbed everywhere: these tests are about the clock and
// the phase transitions, and assert on *which* signal fired rather than on audio.
const whistle = vi.hoisted(() => ({
    unlockAudio: vi.fn(),
    playWhistle: vi.fn(),
    vibrate: vi.fn()
}));

vi.mock('$lib/client/services/whistle.js', () => whistle);

const MINUTE = 60_000;
const KEY = '2026-07-25:league:1:1';
const OTHER_KEY = '2026-07-25:league:1:2';
const STORAGE_KEY = 'leagr:matchTimer';

/** Settings as they arrive from the league: 8 minute games, last play off. */
const DEFAULTS = { durationMinutes: 8, lastPlaySeconds: 0 };
/** Same, with the last play rule opted into at 60s. */
const WITH_LAST_PLAY = { durationMinutes: 8, lastPlaySeconds: 60 };

describe('matchTimer service', () => {
    /** @type {import('$lib/client/services/matchTimer.svelte.js').matchTimer} */
    let timer;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        localStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-25T10:00:00Z'));

        const module = await import('$lib/client/services/matchTimer.svelte.js');
        timer = module.matchTimer;
    });

    afterEach(() => {
        timer?.destroy();
        vi.useRealTimers();
    });

    /** Run the kick-off countdown out so the timer is actually running. */
    function kickOff() {
        timer.start();
        vi.advanceTimersByTime(3000);
        whistle.playWhistle.mockClear();
        whistle.vibrate.mockClear();
    }

    /** Simulate a frozen tab: system clock moves but no interval callback fires. */
    function freezeFor(ms) {
        vi.setSystemTime(Date.now() + ms);
    }

    describe('attach', () => {
        it('applies league settings and starts idle', () => {
            timer.attach(KEY, DEFAULTS);

            expect(timer.status).toBe('idle');
            expect(timer.durationMs).toBe(8 * MINUTE);
            expect(timer.remainingMs).toBe(8 * MINUTE);
            expect(timer.phase).toBe('regulation');
        });

        it('is idempotent - re-attaching the same match does not disturb a running clock', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(2 * MINUTE);

            timer.attach(KEY, DEFAULTS);

            expect(timer.status).toBe('running');
            expect(timer.elapsedMs).toBe(2 * MINUTE);
        });

        it('resets to the league default when moving to another match', () => {
            timer.attach(KEY, DEFAULTS);
            timer.adjustDuration(2);
            kickOff();
            vi.advanceTimersByTime(MINUTE);

            timer.attach(OTHER_KEY, DEFAULTS);

            expect(timer.status).toBe('idle');
            expect(timer.durationMs).toBe(8 * MINUTE);
            expect(timer.elapsedMs).toBe(0);
        });
    });

    describe('countdown and running', () => {
        it('counts 3-2-1 down before starting, then whistles once', () => {
            timer.attach(KEY, DEFAULTS);
            timer.start();

            expect(timer.status).toBe('countdown');
            expect(timer.countdownValue).toBe(3);

            vi.advanceTimersByTime(1000);
            expect(timer.countdownValue).toBe(2);
            vi.advanceTimersByTime(1000);
            expect(timer.countdownValue).toBe(1);
            expect(timer.status).toBe('countdown');
            expect(whistle.playWhistle).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);
            expect(timer.status).toBe('running');
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: false });
        });

        it('unlocks audio from within the start gesture', () => {
            timer.attach(KEY, DEFAULTS);
            timer.start();
            expect(whistle.unlockAudio).toHaveBeenCalled();
        });

        it('accrues elapsed time by the wall clock', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();

            vi.advanceTimersByTime(90_000);

            expect(timer.elapsedMs).toBe(90_000);
            expect(timer.remainingMs).toBe(8 * MINUTE - 90_000);
        });

        it('stays correct across a frozen tab - the anchoring guarantee', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(30_000);

            // Five minutes pass with the tab suspended: no interval callbacks at all.
            freezeFor(5 * MINUTE);
            expect(timer.elapsedMs).toBe(30_000); // stale until something ticks

            vi.advanceTimersByTime(250); // one tick on wake
            expect(timer.elapsedMs).toBe(5 * MINUTE + 30_250);
        });
    });

    describe('late start', () => {
        it('picks up a game already in progress with no countdown and no whistle', () => {
            timer.attach(KEY, DEFAULTS);

            timer.startLate();

            expect(timer.status).toBe('running');
            expect(timer.countdownValue).toBe(0);
            // Announcing a kick-off would be wrong: play is already under way.
            expect(whistle.playWhistle).not.toHaveBeenCalled();
            expect(whistle.vibrate).not.toHaveBeenCalled();

            vi.advanceTimersByTime(MINUTE);
            expect(timer.elapsedMs).toBe(MINUTE);
        });

        it('still unlocks audio so full time is audible', () => {
            timer.attach(KEY, DEFAULTS);
            timer.startLate();
            expect(whistle.unlockAudio).toHaveBeenCalled();

            vi.advanceTimersByTime(8 * MINUTE);

            expect(timer.status).toBe('finished');
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: true });
        });

        it('does not disturb a clock that is already running', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(2 * MINUTE);

            timer.startLate();

            expect(timer.status).toBe('running');
            expect(timer.elapsedMs).toBe(2 * MINUTE);
        });

        it('leaves a paused clock paused', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(MINUTE);
            timer.pause();

            timer.startLate();

            expect(timer.status).toBe('paused');
            expect(timer.elapsedMs).toBe(MINUTE);
        });
    });

    describe('pause and resume', () => {
        it('freezes elapsed time while paused', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(MINUTE);

            timer.pause();
            expect(timer.status).toBe('paused');

            vi.advanceTimersByTime(30 * MINUTE);
            expect(timer.elapsedMs).toBe(MINUTE);
        });

        it('continues from the frozen value on resume', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(MINUTE);
            timer.pause();
            vi.advanceTimersByTime(10 * MINUTE);

            timer.resume();
            vi.advanceTimersByTime(30_000);

            expect(timer.status).toBe('running');
            expect(timer.elapsedMs).toBe(MINUTE + 30_000);
        });

        it('whistles on resume without another countdown', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            timer.pause();

            timer.resume();

            expect(timer.status).toBe('running');
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: false });
        });
    });

    describe('duration adjustment', () => {
        it('clamps between 1 and 60 minutes', () => {
            timer.attach(KEY, DEFAULTS);

            timer.adjustDuration(-20);
            expect(timer.durationMs).toBe(MINUTE);

            timer.adjustDuration(200);
            expect(timer.durationMs).toBe(60 * MINUTE);
        });

        it('can be raised mid-run for the cup final', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(MINUTE);

            timer.adjustDuration(2);

            expect(timer.durationMs).toBe(10 * MINUTE);
            expect(timer.remainingMs).toBe(9 * MINUTE);
            expect(timer.status).toBe('running');
        });

        it('finishes immediately when shrunk below elapsed and last play is off', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(3 * MINUTE);

            timer.adjustDuration(-6); // 8 -> 2 minutes, already past it

            expect(timer.status).toBe('finished');
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: true });
        });

        it('rewinding back into regulation re-arms the full time signal', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();
            vi.advanceTimersByTime(8 * MINUTE);
            expect(timer.phase).toBe('lastPlay');
            whistle.playWhistle.mockClear();

            timer.adjustDuration(2); // 8 -> 10 minutes, back inside regulation
            expect(timer.phase).toBe('regulation');

            vi.advanceTimersByTime(2 * MINUTE); // cross 10:00
            expect(timer.phase).toBe('lastPlay');
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: false });
        });
    });

    describe('full time without last play', () => {
        it('ends with a single long whistle at 0:00', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();

            vi.advanceTimersByTime(8 * MINUTE);

            expect(timer.status).toBe('finished');
            expect(timer.remainingMs).toBe(0);
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: true });
        });

        it('fires exactly once even as ticks continue', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();

            vi.advanceTimersByTime(8 * MINUTE);
            vi.advanceTimersByTime(2 * MINUTE);

            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
        });
    });

    describe('last play', () => {
        it('opens with a short whistle and counts the cap down', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();

            vi.advanceTimersByTime(8 * MINUTE);

            expect(timer.status).toBe('running');
            expect(timer.phase).toBe('lastPlay');
            expect(timer.isLastPlay).toBe(true);
            expect(timer.remainingMs).toBe(60_000);
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: false });

            vi.advanceTimersByTime(20_000);
            expect(timer.remainingMs).toBe(40_000);
        });

        it('does not re-whistle on subsequent ticks', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();

            vi.advanceTimersByTime(8 * MINUTE);
            vi.advanceTimersByTime(10_000);

            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
        });

        it('ends with a long whistle when the cap expires untouched', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();

            vi.advanceTimersByTime(8 * MINUTE);
            whistle.playWhistle.mockClear();
            vi.advanceTimersByTime(60_000);

            expect(timer.status).toBe('finished');
            expect(timer.remainingMs).toBe(0);
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: true });
        });

        it('endLastPlay ends it early on the referee tap', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();
            vi.advanceTimersByTime(8 * MINUTE + 15_000);
            whistle.playWhistle.mockClear();

            timer.endLastPlay();

            expect(timer.status).toBe('finished');
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: true });
        });

        it('endLastPlay is a no-op during regulation', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();
            vi.advanceTimersByTime(2 * MINUTE);

            timer.endLastPlay();

            expect(timer.status).toBe('running');
            expect(whistle.playWhistle).not.toHaveBeenCalled();
        });

        it('preserves the remaining cap across a pause', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();
            vi.advanceTimersByTime(8 * MINUTE + 20_000);
            expect(timer.remainingMs).toBe(40_000);

            timer.pause();
            vi.advanceTimersByTime(5 * MINUTE);
            expect(timer.remainingMs).toBe(40_000);

            timer.resume();
            vi.advanceTimersByTime(10_000);
            expect(timer.remainingMs).toBe(30_000);
            expect(timer.status).toBe('running');
        });

        it('blowing past both thresholds while frozen gives one long whistle only', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();
            vi.advanceTimersByTime(MINUTE);

            // Phone locked in a pocket through full time and the whole last play.
            freezeFor(10 * MINUTE);
            vi.advanceTimersByTime(250);

            expect(timer.status).toBe('finished');
            expect(whistle.playWhistle).toHaveBeenCalledTimes(1);
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: true });
        });
    });

    describe('reset', () => {
        it('returns to idle but keeps an adjusted duration', () => {
            timer.attach(KEY, DEFAULTS);
            timer.adjustDuration(2);
            kickOff();
            vi.advanceTimersByTime(3 * MINUTE);

            timer.reset();

            expect(timer.status).toBe('idle');
            expect(timer.elapsedMs).toBe(0);
            expect(timer.durationMs).toBe(10 * MINUTE);
            expect(timer.remainingMs).toBe(10 * MINUTE);
        });

        it('re-arms the signals so the match can be run again', () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();
            vi.advanceTimersByTime(9 * MINUTE);
            expect(timer.status).toBe('finished');

            timer.reset();
            kickOff();
            vi.advanceTimersByTime(8 * MINUTE);

            expect(timer.phase).toBe('lastPlay');
            expect(whistle.playWhistle).toHaveBeenCalledWith({ long: false });
        });
    });

    describe('persistence', () => {
        it('restores a running clock at the correct elapsed time', async () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(2 * MINUTE);

            // Reload: fresh module instance, same localStorage, 30s later.
            vi.resetModules();
            freezeFor(30_000);
            const reloaded = (await import('$lib/client/services/matchTimer.svelte.js')).matchTimer;
            reloaded.attach(KEY, DEFAULTS);

            expect(reloaded.status).toBe('running');
            expect(reloaded.elapsedMs).toBe(2 * MINUTE + 30_000);
            reloaded.destroy();
        });

        it('ignores a snapshot belonging to a different match', async () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(2 * MINUTE);

            vi.resetModules();
            const reloaded = (await import('$lib/client/services/matchTimer.svelte.js')).matchTimer;
            reloaded.attach(OTHER_KEY, DEFAULTS);

            expect(reloaded.status).toBe('idle');
            expect(reloaded.elapsedMs).toBe(0);
            reloaded.destroy();
        });

        it('restores mid-last-play without replaying the full time whistle', async () => {
            timer.attach(KEY, WITH_LAST_PLAY);
            kickOff();
            vi.advanceTimersByTime(8 * MINUTE + 10_000);
            expect(timer.phase).toBe('lastPlay');

            vi.resetModules();
            whistle.playWhistle.mockClear();
            const reloaded = (await import('$lib/client/services/matchTimer.svelte.js')).matchTimer;
            reloaded.attach(KEY, WITH_LAST_PLAY);
            vi.advanceTimersByTime(250);

            expect(reloaded.phase).toBe('lastPlay');
            expect(reloaded.status).toBe('running');
            expect(whistle.playWhistle).not.toHaveBeenCalled();
            reloaded.destroy();
        });

        it('survives unusable localStorage', async () => {
            const setItem = Storage.prototype.setItem;
            const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
            Storage.prototype.setItem = vi.fn(() => {
                throw new Error('QuotaExceededError');
            });

            try {
                timer.attach(KEY, DEFAULTS);
                kickOff();
                vi.advanceTimersByTime(MINUTE);
                expect(timer.elapsedMs).toBe(MINUTE);
                expect(logged).toHaveBeenCalled();
            } finally {
                Storage.prototype.setItem = setItem;
                logged.mockRestore();
            }
        });
    });

    describe('haptics', () => {
        it('buzzes short at kick-off and long at full time', () => {
            timer.attach(KEY, DEFAULTS);
            timer.start();
            vi.advanceTimersByTime(3000);
            expect(whistle.vibrate).toHaveBeenLastCalledWith([120]);

            vi.advanceTimersByTime(8 * MINUTE);
            expect(whistle.vibrate).toHaveBeenLastCalledWith([400, 120, 400, 120, 600]);
        });
    });

    describe('mute', () => {
        it('suppresses audio but keeps the clock and haptics running', () => {
            timer.attach(KEY, DEFAULTS);
            timer.setMuted(true);
            kickOff();

            vi.advanceTimersByTime(8 * MINUTE);

            expect(whistle.playWhistle).not.toHaveBeenCalled();
            expect(whistle.vibrate).toHaveBeenCalled();
            expect(timer.status).toBe('finished');
        });

        it('persists across a reload', async () => {
            timer.attach(KEY, DEFAULTS);
            timer.setMuted(true);

            vi.resetModules();
            const reloaded = (await import('$lib/client/services/matchTimer.svelte.js')).matchTimer;

            expect(reloaded.muted).toBe(true);
            reloaded.destroy();
        });
    });

    describe('cleanup', () => {
        it('stops ticking once destroyed', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(MINUTE);

            timer.destroy();
            const at = timer.elapsedMs;
            vi.advanceTimersByTime(MINUTE);

            expect(timer.elapsedMs).toBe(at);
        });

        it('leaves the snapshot behind so the clock can be picked back up', () => {
            timer.attach(KEY, DEFAULTS);
            kickOff();
            vi.advanceTimersByTime(MINUTE);

            timer.detach();

            expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
        });
    });
});
