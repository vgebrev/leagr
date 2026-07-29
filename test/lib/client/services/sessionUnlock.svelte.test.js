import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const DATE = '2026-07-25';
const OTHER_DATE = '2026-07-18';

/** Registration window closing at midday on the session date. */
const SETTINGS = {
    registrationWindow: {
        enabled: true,
        startDayOffset: -2,
        startTime: '07:30',
        endDayOffset: 0,
        endTime: '12:00'
    }
};

describe('sessionUnlock service', () => {
    /** @type {import('$lib/client/services/sessionUnlock.svelte.js').sessionUnlock} */
    let sessionUnlock;
    /** @type {typeof import('$lib/client/services/sessionUnlock.svelte.js').isSessionLocked} */
    let isSessionLocked;

    beforeEach(async () => {
        vi.resetModules();
        const module = await import('$lib/client/services/sessionUnlock.svelte.js');
        sessionUnlock = module.sessionUnlock;
        isSessionLocked = module.isSessionLocked;
    });

    afterEach(() => {
        sessionUnlock?.lock();
        vi.useRealTimers();
    });

    describe('unlock state', () => {
        it('starts locked', () => {
            expect(sessionUnlock.unlockedDate).toBeNull();
            expect(sessionUnlock.isUnlocked(DATE)).toBe(false);
        });

        it('unlocks only the exact date it was given', () => {
            sessionUnlock.unlock(DATE);

            expect(sessionUnlock.unlockedDate).toBe(DATE);
            expect(sessionUnlock.isUnlocked(DATE)).toBe(true);
            expect(sessionUnlock.isUnlocked(OTHER_DATE)).toBe(false);
        });

        it('never reports an empty date as unlocked', () => {
            sessionUnlock.unlock(DATE);

            expect(sessionUnlock.isUnlocked(null)).toBe(false);
            expect(sessionUnlock.isUnlocked(undefined)).toBe(false);
            expect(sessionUnlock.isUnlocked('')).toBe(false);
        });

        it('treats an empty unlock as no unlock', () => {
            sessionUnlock.unlock(null);

            expect(sessionUnlock.unlockedDate).toBeNull();
        });

        it('re-locks', () => {
            sessionUnlock.unlock(DATE);
            sessionUnlock.lock();

            expect(sessionUnlock.unlockedDate).toBeNull();
            expect(sessionUnlock.isUnlocked(DATE)).toBe(false);
        });
    });

    describe('isSessionLocked', () => {
        it('is unlocked while the competition is still running', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-07-24T09:00:00'));

            expect(isSessionLocked(DATE, SETTINGS)).toBe(false);
        });

        it('locks once the competition has ended', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-07-26T09:00:00'));

            expect(isSessionLocked(DATE, SETTINGS)).toBe(true);
        });

        it('unlocks an ended session for the unlocked date', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-07-26T09:00:00'));
            sessionUnlock.unlock(DATE);

            expect(isSessionLocked(DATE, SETTINGS)).toBe(false);
        });

        it('leaves other ended sessions locked', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-07-26T09:00:00'));
            sessionUnlock.unlock(DATE);

            expect(isSessionLocked(OTHER_DATE, SETTINGS)).toBe(true);
        });
    });
});
