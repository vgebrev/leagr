/**
 * Presentation scale for attack/control ratings.
 *
 * The stored rating is a weighted mean of percentile positions in the established
 * pool, so it spans the full 0-1 range and its median player sits near 0.5. That is
 * the right number to compute with, but it is a harsh number to show a player: the
 * bottom of a distribution somebody is genuinely in still reads as a zero.
 *
 * So the bar runs from a floor rather than from zero. The transform is deliberately
 * affine — a rescale, not a curve:
 *
 *     display(v) = FLOOR + v * (100 - FLOOR)
 *
 * Two properties follow, and both are the reason this replaced the old
 * `pow(0.1 + 0.9v, 0.45)` gamma curve:
 *
 * 1. Relative gaps survive. Every difference is scaled by the same factor, so a
 *    specialist still reads as a specialist. The gamma curve squashed the top of the
 *    scale, which made an attacker and a defender look alike.
 * 2. It commutes with a weighted mean, so the component numbers in a rating's
 *    tooltip average to the rating shown on its bar. Put everything through here and
 *    the two can no longer disagree.
 */

/** Lowest percentage any rating is shown as. Raise to be kinder, lower to be starker. */
export const RATING_DISPLAY_FLOOR = 25;

/**
 * Put a stored 0-1 rating or norm on the display scale.
 * @param {number|null|undefined} value
 * @returns {number|null} percentage in [RATING_DISPLAY_FLOOR, 100], or null
 */
export function displayRatingPercent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    const clamped = Math.min(1, Math.max(0, value));
    return RATING_DISPLAY_FLOOR + clamped * (100 - RATING_DISPLAY_FLOOR);
}

/**
 * The same value rounded for display as a whole number.
 * @param {number|null|undefined} value
 * @returns {number|null}
 */
export function displayRatingRounded(value) {
    const pct = displayRatingPercent(value);
    return pct === null ? null : Math.round(pct);
}

/**
 * How much a player's stronger side counts toward the overall badge.
 * 0.5 would be a plain average of the two bars.
 */
export const OVERALL_STRONG_SIDE_WEIGHT = 0.7;

/**
 * The overall badge: a blend of the two numbers on the bars, leaning toward whichever
 * side the player is better at.
 *
 *     overall = w·max + (1 - w)·min   ≡   mean + (w - 0.5) · |attack - defence|
 *
 * A specialist should not be marked down for the half of the game they don't play —
 * an elite attacker with ordinary defending is a valuable player, and breadth is
 * already rewarded separately by the all-rounder and complete-player badges. Balanced
 * players are untouched: the two forms agree exactly when the sides are equal, and
 * nobody's badge is lower than their average.
 *
 * Chosen over a power mean because it is affine-equivariant — it commutes with
 * displayRatingPercent, so the badge means the same thing computed from the displayed
 * numbers or from the raw ratings, and retuning RATING_DISPLAY_FLOOR cannot silently
 * reshape it. A power mean's behaviour depends on where the floor puts zero.
 *
 * @param {number|null|undefined} attackingRating
 * @param {number|null|undefined} controlRating
 * @returns {number|null} whole-number badge, or null unless both sides are rated
 */
export function displayOverall(attackingRating, controlRating) {
    const attack = displayRatingRounded(attackingRating);
    const control = displayRatingRounded(controlRating);
    if (attack === null || control === null) return null;
    const w = OVERALL_STRONG_SIDE_WEIGHT;
    return Math.round(w * Math.max(attack, control) + (1 - w) * Math.min(attack, control));
}
