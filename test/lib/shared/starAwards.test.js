import { describe, it, expect } from 'vitest';
import { awardTotals, longestAwardStreaks } from '#lib/shared/starAwards.js';

/**
 * @param {string} date
 * @param {string[]|null} awards - null for a missed session
 */
const session = (date, awards) =>
    awards === null ? { date, played: false } : { date, played: true, awards };

describe('awardTotals', () => {
    it('counts each award across sessions', () => {
        const details = [
            session('2026-03-07', ['mvp', 'goldenBoot']),
            session('2026-03-14', null),
            session('2026-03-21', ['goldenBoot']),
            session('2026-03-28', [])
        ];

        expect(awardTotals(details)).toEqual({
            mvp: 1,
            goldenBoot: 2,
            playmaker: 0,
            brickWall: 0,
            goldenGlove: 0
        });
    });

    it('is all zeros without award data', () => {
        const totals = awardTotals([{ date: '2026-01-03', played: true }]);

        expect(Object.values(totals)).toEqual([0, 0, 0, 0, 0]);
    });
});

describe('longestAwardStreaks', () => {
    it('finds the longest run per award, not the latest', () => {
        const details = [
            session('2026-03-07', ['goldenBoot']),
            session('2026-03-14', ['goldenBoot', 'mvp']),
            session('2026-03-21', ['goldenBoot']),
            session('2026-03-28', []),
            session('2026-04-04', ['goldenBoot'])
        ];

        expect(longestAwardStreaks(details)).toMatchObject({ goldenBoot: 3, mvp: 1, playmaker: 0 });
    });

    it('does not break a run on a missed session', () => {
        const details = [
            session('2026-03-07', ['brickWall']),
            session('2026-03-14', null),
            session('2026-03-21', ['brickWall'])
        ];

        expect(longestAwardStreaks(details).brickWall).toBe(2);
    });

    it('breaks a run on an appearance without the award', () => {
        const details = [
            session('2026-03-07', ['brickWall']),
            session('2026-03-14', ['mvp']),
            session('2026-03-21', ['brickWall'])
        ];

        expect(longestAwardStreaks(details).brickWall).toBe(1);
    });
});
