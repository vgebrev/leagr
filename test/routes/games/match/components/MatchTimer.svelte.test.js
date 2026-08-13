import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';

// Same stub as the service tests: this file is about which controls the referee
// is offered, not about audio.
const whistle = vi.hoisted(() => ({
    unlockAudio: vi.fn(),
    playWhistle: vi.fn(),
    vibrate: vi.fn()
}));

vi.mock('$lib/client/services/whistle.js', () => whistle);

const MatchTimer = (
    await import('../../../../../src/routes/games/match/components/MatchTimer.svelte')
).default;
const { matchTimer } = await import('$lib/client/services/matchTimer.svelte.js');

const MINUTE = 60_000;
const WITH_LAST_PLAY = { durationMinutes: 8, lastPlaySeconds: 60 };

describe('MatchTimer controls', () => {
    let keySeed = 0;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-25T10:00:00Z'));
        matchTimer.setExpanded(true);
    });

    afterEach(() => {
        matchTimer.destroy();
        vi.useRealTimers();
    });

    /**
     * Put the clock in play on a match of its own, so no test can pick up the
     * stored clock of another.
     * @param {number} elapsedMs - Time on the clock at render
     */
    function playFor(elapsedMs) {
        matchTimer.attach(`2026-07-25:league:1:${++keySeed}`, WITH_LAST_PLAY);
        matchTimer.start();
        vi.advanceTimersByTime(3000 + elapsedMs);
    }

    it('offers only pause during regulation', () => {
        playFor(2 * MINUTE);
        render(MatchTimer);

        expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /end play/i })).toBeNull();
    });

    it('offers pause alongside end play once last play starts', () => {
        playFor(8 * MINUTE);
        render(MatchTimer);

        expect(matchTimer.isLastPlay).toBe(true);
        expect(screen.getByRole('button', { name: 'End Play' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    });

    it('offers resume, not end play only, when paused during last play', () => {
        playFor(8 * MINUTE + 20_000);
        matchTimer.pause();
        render(MatchTimer);

        expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'End Play' })).toBeTruthy();
    });

    it('keeps both controls in the collapsed row', () => {
        matchTimer.setExpanded(false);
        playFor(8 * MINUTE);
        render(MatchTimer);

        expect(screen.getByRole('button', { name: 'End Play' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    });
});
