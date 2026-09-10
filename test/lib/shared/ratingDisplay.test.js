import { describe, it, expect } from 'vitest';
import {
    OVERALL_STRONG_SIDE_WEIGHT,
    RATING_DISPLAY_FLOOR,
    displayOverall,
    displayRatingPercent,
    displayRatingRounded
} from '$lib/shared/ratingDisplay.js';

describe('ratingDisplay', () => {
    it('maps the full 0-1 range onto floor..100', () => {
        expect(displayRatingPercent(0)).toBe(RATING_DISPLAY_FLOOR);
        expect(displayRatingPercent(1)).toBe(100);
        expect(displayRatingPercent(0.5)).toBeCloseTo((RATING_DISPLAY_FLOOR + 100) / 2, 6);
    });

    it('returns null for a missing rating rather than a zero', () => {
        expect(displayRatingPercent(null)).toBeNull();
        expect(displayRatingPercent(undefined)).toBeNull();
        expect(displayRatingRounded(null)).toBeNull();
    });

    it('clamps values outside 0-1 instead of drawing past the ends of the bar', () => {
        expect(displayRatingPercent(-0.5)).toBe(RATING_DISPLAY_FLOOR);
        expect(displayRatingPercent(1.5)).toBe(100);
    });

    it('preserves the order and the relative size of gaps', () => {
        // An affine rescale: every gap shrinks by the same factor, so a specialist
        // still reads as a specialist. A gamma curve would flatten the top instead.
        const [a, b, c] = [0.2, 0.5, 0.9].map(displayRatingPercent);
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(c);
        expect((c - b) / (b - a)).toBeCloseTo((0.9 - 0.5) / (0.5 - 0.2), 6);
    });

    it('commutes with a weighted mean, so components average to the rating they build', () => {
        // This is what lets the tooltip's component numbers agree with the bar.
        const terms = [
            [3, 0.62],
            [2, 0.41],
            [0.6, 0.88]
        ];
        const den = terms.reduce((s, [w]) => s + w, 0);
        const rating = terms.reduce((s, [w, v]) => s + w * v, 0) / den;
        const meanOfDisplays =
            terms.reduce((s, [w, v]) => s + w * displayRatingPercent(v), 0) / den;
        expect(meanOfDisplays).toBeCloseTo(displayRatingPercent(rating), 6);
    });

    it('rounds rather than truncating, so the top of the scale is reachable', () => {
        expect(displayRatingRounded(0.999)).toBe(100);
        expect(displayRatingRounded(0.5)).toBe(63);
    });
});

describe('displayOverall', () => {
    it('leaves a balanced player on their average', () => {
        // 0.7·max + 0.3·min collapses to the mean when the two sides are equal.
        expect(displayOverall(0.8, 0.8)).toBe(displayRatingRounded(0.8));
        expect(displayOverall(0.3, 0.3)).toBe(displayRatingRounded(0.3));
    });

    it('lifts a specialist by a fixed share of their gap', () => {
        // Jay: attack 96, defence 37 on the display scale. mean 66, +0.2 x 59 gap.
        const attack = 0.947; // -> 96
        const control = 0.16; // -> 37
        const [a, c] = [displayRatingRounded(attack), displayRatingRounded(control)];
        const mean = (a + c) / 2;
        expect(displayOverall(attack, control)).toBe(
            Math.round(mean + (OVERALL_STRONG_SIDE_WEIGHT - 0.5) * Math.abs(a - c))
        );
        expect(displayOverall(attack, control)).toBeGreaterThan(Math.round(mean));
    });

    it('never scores a player below their average or above their better side', () => {
        for (const [a, c] of [
            [0, 1],
            [0.2, 0.9],
            [0.55, 0.45],
            [1, 1],
            [0, 0]
        ]) {
            const [da, dc] = [displayRatingRounded(a), displayRatingRounded(c)];
            const overall = displayOverall(a, c);
            expect(overall).toBeGreaterThanOrEqual(Math.round((da + dc) / 2));
            expect(overall).toBeLessThanOrEqual(Math.max(da, dc));
            expect(overall).toBeGreaterThanOrEqual(Math.min(da, dc));
        }
    });

    it('is symmetric — it does not care which side is the strong one', () => {
        expect(displayOverall(0.9, 0.2)).toBe(displayOverall(0.2, 0.9));
    });

    it('needs both sides rated', () => {
        expect(displayOverall(0.8, null)).toBeNull();
        expect(displayOverall(null, 0.8)).toBeNull();
        expect(displayOverall(null, null)).toBeNull();
    });
});
