import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isTeamDrawOpen } from '$lib/shared/helpers.js';

describe('isTeamDrawOpen', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const makeSettings = (overrides = {}) => ({
        registrationWindow: {
            enabled: true,
            startDayOffset: -2,
            startTime: '07:30',
            teamDrawDayOffset: -1,
            teamDrawTime: '16:00',
            endDayOffset: 0,
            endTime: '12:00',
            ...overrides
        }
    });

    describe('when time controls are disabled', () => {
        it('returns true regardless of current time', () => {
            vi.setSystemTime(new Date('2025-04-12T08:00:00'));
            const settings = makeSettings();
            settings.registrationWindow.enabled = false;
            expect(isTeamDrawOpen('2025-04-19', settings)).toBe(true);
        });
    });

    describe('when settings are absent', () => {
        it('returns true when settings is null', () => {
            expect(isTeamDrawOpen('2025-04-19', null)).toBe(true);
        });

        it('returns true when dateString is null', () => {
            expect(isTeamDrawOpen(null, makeSettings())).toBe(true);
        });
    });

    describe('when time controls are enabled', () => {
        it('returns false before the draw window opens', () => {
            // Competition Saturday 2025-04-19, draw opens Friday 2025-04-18 at 16:00
            vi.setSystemTime(new Date('2025-04-18T15:59:00'));
            expect(isTeamDrawOpen('2025-04-19', makeSettings())).toBe(false);
        });

        it('returns true exactly at the draw open time', () => {
            vi.setSystemTime(new Date('2025-04-18T16:00:00'));
            expect(isTeamDrawOpen('2025-04-19', makeSettings())).toBe(true);
        });

        it('returns true after the draw window has opened', () => {
            vi.setSystemTime(new Date('2025-04-18T18:00:00'));
            expect(isTeamDrawOpen('2025-04-19', makeSettings())).toBe(true);
        });

        it('returns true on competition day itself', () => {
            vi.setSystemTime(new Date('2025-04-19T09:00:00'));
            expect(isTeamDrawOpen('2025-04-19', makeSettings())).toBe(true);
        });
    });

    describe('defaults when fields are absent', () => {
        it('defaults to offset -1 and time 16:00 when fields are missing', () => {
            const settings = makeSettings();
            delete settings.registrationWindow.teamDrawDayOffset;
            delete settings.registrationWindow.teamDrawTime;

            // Just before default open time (Friday 15:59 for Saturday competition)
            vi.setSystemTime(new Date('2025-04-18T15:59:00'));
            expect(isTeamDrawOpen('2025-04-19', settings)).toBe(false);

            vi.setSystemTime(new Date('2025-04-18T16:00:00'));
            expect(isTeamDrawOpen('2025-04-19', settings)).toBe(true);
        });
    });

    describe('custom offsets', () => {
        it('respects a 2-day offset', () => {
            // Competition Saturday, draw opens Thursday at 16:00 (offset -2)
            const settings = makeSettings({ teamDrawDayOffset: -2, teamDrawTime: '16:00' });

            vi.setSystemTime(new Date('2025-04-17T15:59:00')); // Thursday before 16:00
            expect(isTeamDrawOpen('2025-04-19', settings)).toBe(false);

            vi.setSystemTime(new Date('2025-04-17T16:00:00')); // Thursday at 16:00
            expect(isTeamDrawOpen('2025-04-19', settings)).toBe(true);
        });

        it('respects a same-day offset (0)', () => {
            // Draw opens on competition day itself at 10:00
            const settings = makeSettings({ teamDrawDayOffset: 0, teamDrawTime: '10:00' });

            vi.setSystemTime(new Date('2025-04-19T09:59:00'));
            expect(isTeamDrawOpen('2025-04-19', settings)).toBe(false);

            vi.setSystemTime(new Date('2025-04-19T10:00:00'));
            expect(isTeamDrawOpen('2025-04-19', settings)).toBe(true);
        });
    });
});
