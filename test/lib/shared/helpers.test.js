import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    isTeamDrawOpen,
    isCompetitionEnded,
    isRegistrationOpen,
    hasSessionStarted
} from '$lib/shared/helpers.js';

describe('isRegistrationOpen', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Saturday 2025-04-12: registration opens Thursday 2025-04-10 at 07:30. */
    const SATURDAY = '2025-04-12';

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

    it('returns true when time controls are disabled', () => {
        vi.setSystemTime(new Date('2025-01-01T00:00:00'));
        expect(isRegistrationOpen(SATURDAY, makeSettings({ enabled: false }))).toBe(true);
    });

    it('returns true when settings are absent', () => {
        vi.setSystemTime(new Date('2025-01-01T00:00:00'));
        expect(isRegistrationOpen(SATURDAY, null)).toBe(true);
        expect(isRegistrationOpen(SATURDAY, {})).toBe(true);
    });

    it('returns true without a date', () => {
        expect(isRegistrationOpen(null, makeSettings())).toBe(true);
    });

    it('is closed a minute before the opening time', () => {
        vi.setSystemTime(new Date('2025-04-10T07:29:00'));
        expect(isRegistrationOpen(SATURDAY, makeSettings())).toBe(false);
    });

    it('is open exactly on the opening time', () => {
        vi.setSystemTime(new Date('2025-04-10T07:30:00'));
        expect(isRegistrationOpen(SATURDAY, makeSettings())).toBe(true);
    });

    it('stays open afterwards, including past the team draw', () => {
        vi.setSystemTime(new Date('2025-04-11T18:00:00'));
        expect(isRegistrationOpen(SATURDAY, makeSettings())).toBe(true);
    });

    it('honours a custom offset and time', () => {
        const settings = makeSettings({ startDayOffset: -5, startTime: '20:00' });

        vi.setSystemTime(new Date('2025-04-07T19:59:00'));
        expect(isRegistrationOpen(SATURDAY, settings)).toBe(false);

        vi.setSystemTime(new Date('2025-04-07T20:00:00'));
        expect(isRegistrationOpen(SATURDAY, settings)).toBe(true);
    });

    it('opens before the team draw does', () => {
        // The gap the fantasy market now lives in: signups are open, teams are not drawn.
        vi.setSystemTime(new Date('2025-04-10T09:00:00'));
        expect(isRegistrationOpen(SATURDAY, makeSettings())).toBe(true);
        expect(isTeamDrawOpen(SATURDAY, makeSettings())).toBe(false);
    });
});

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

describe('isCompetitionEnded', () => {
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

    it('returns false without a date', () => {
        vi.setSystemTime(new Date('2025-04-25T08:00:00'));
        expect(isCompetitionEnded(null, makeSettings())).toBe(false);
        expect(isCompetitionEnded(undefined, makeSettings())).toBe(false);
    });

    describe('when time controls are enabled', () => {
        it('is false right up to the end time', () => {
            vi.setSystemTime(new Date('2025-04-19T12:00:00'));
            expect(isCompetitionEnded('2025-04-19', makeSettings())).toBe(false);
        });

        it('is true just after the end time', () => {
            vi.setSystemTime(new Date('2025-04-19T12:00:01'));
            expect(isCompetitionEnded('2025-04-19', makeSettings())).toBe(true);
        });

        it('is false well before the session', () => {
            vi.setSystemTime(new Date('2025-04-17T08:00:00'));
            expect(isCompetitionEnded('2025-04-19', makeSettings())).toBe(false);
        });

        it('respects a positive end day offset', () => {
            // Competition stays open until midday the day after the session
            const settings = makeSettings({ endDayOffset: 1 });

            vi.setSystemTime(new Date('2025-04-19T23:00:00'));
            expect(isCompetitionEnded('2025-04-19', settings)).toBe(false);

            vi.setSystemTime(new Date('2025-04-20T12:01:00'));
            expect(isCompetitionEnded('2025-04-19', settings)).toBe(true);
        });

        it('respects a custom end time', () => {
            const settings = makeSettings({ endTime: '18:30' });

            vi.setSystemTime(new Date('2025-04-19T18:29:00'));
            expect(isCompetitionEnded('2025-04-19', settings)).toBe(false);

            vi.setSystemTime(new Date('2025-04-19T18:31:00'));
            expect(isCompetitionEnded('2025-04-19', settings)).toBe(true);
        });
    });

    describe('when time controls are disabled', () => {
        it('falls back to midnight after the session date', () => {
            const settings = makeSettings({ enabled: false });

            vi.setSystemTime(new Date('2025-04-19T23:59:00'));
            expect(isCompetitionEnded('2025-04-19', settings)).toBe(false);

            vi.setSystemTime(new Date('2025-04-20T00:01:00'));
            expect(isCompetitionEnded('2025-04-19', settings)).toBe(true);
        });

        it('uses the same fallback when settings are absent', () => {
            vi.setSystemTime(new Date('2025-04-20T00:01:00'));
            expect(isCompetitionEnded('2025-04-19', null)).toBe(true);
            expect(isCompetitionEnded('2025-04-20', null)).toBe(false);
        });
    });
});

describe('hasSessionStarted', () => {
    it('is false for a session with no games at all', () => {
        expect(hasSessionStarted(null)).toBe(false);
        expect(hasSessionStarted({})).toBe(false);
        expect(hasSessionStarted({ rounds: [] })).toBe(false);
    });

    it('is false while the sheet is still blank', () => {
        const games = {
            rounds: [
                [{ home: 'blue', away: 'white', homeScore: null, awayScore: null }],
                [{ home: 'blue', away: 'green', homeScore: null, awayScore: null }]
            ]
        };
        expect(hasSessionStarted(games)).toBe(false);
    });

    it('counts a goalless draw as a played match', () => {
        const games = {
            rounds: [[{ home: 'blue', away: 'white', homeScore: 0, awayScore: 0 }]]
        };
        expect(hasSessionStarted(games)).toBe(true);
    });

    it('ignores byes, which carry no score and can never be played', () => {
        const games = {
            rounds: [[{ bye: 'green' }, { home: 'blue', away: 'white', homeScore: null }]]
        };
        expect(hasSessionStarted(games)).toBe(false);
    });

    // Scores are entered from the match tracker in whatever order the admin opens them,
    // so the opening fixture is not necessarily the first one written down.
    it('counts a score recorded out of order', () => {
        const games = {
            rounds: [
                [{ home: 'blue', away: 'white', homeScore: null, awayScore: null }],
                [{ home: 'blue', away: 'green', homeScore: 2, awayScore: 1 }]
            ]
        };
        expect(hasSessionStarted(games)).toBe(true);
    });

    it('counts a knockout result too', () => {
        const games = {
            rounds: [[{ home: 'blue', away: 'white', homeScore: null, awayScore: null }]],
            'knockout-games': {
                bracket: [{ home: 'blue', away: 'white', homeScore: 3, awayScore: 2 }]
            }
        };
        expect(hasSessionStarted(games)).toBe(true);
    });
});
