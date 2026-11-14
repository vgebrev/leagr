/**
 * Stars of the Day: the individual awards a session hands out. The server decides
 * who took them (`ballerAwards` in `#lib/server/momentum.js`); this module is the
 * client-side vocabulary and the season summaries derived from a player's sessions.
 */

/** Award categories in display order. */
export const STAR_AWARD_TYPES = /** @type {BallerAwardType[]} */ ([
    'mvp',
    'goldenBoot',
    'playmaker',
    'brickWall',
    'goldenGlove'
]);

/** @type {Record<BallerAwardType, string>} */
export const STAR_AWARD_LABELS = {
    mvp: 'MVP',
    goldenBoot: 'Golden Boot',
    playmaker: 'Playmaker',
    brickWall: 'Brick Wall',
    goldenGlove: 'Golden Glove'
};

/** @returns {Record<BallerAwardType, number>} */
function zeroCounts() {
    return { mvp: 0, goldenBoot: 0, playmaker: 0, brickWall: 0, goldenGlove: 0 };
}

/**
 * How many times the player took each award across the given sessions.
 * @param {PlayerSessionDetail[]} details
 * @returns {Record<BallerAwardType, number>}
 */
export function awardTotals(details) {
    const totals = zeroCounts();
    for (const detail of details) {
        for (const award of detail.awards ?? []) totals[award]++;
    }
    return totals;
}

/**
 * The player's longest run of consecutive appearances taking each award. A missed
 * session doesn't break a run (same rule as the league and cup win streaks); an
 * appearance without the award does.
 * @param {PlayerSessionDetail[]} details - chronological (oldest first)
 * @returns {Record<BallerAwardType, number>}
 */
export function longestAwardStreaks(details) {
    const longest = zeroCounts();
    const current = zeroCounts();
    for (const detail of details) {
        if (!detail.played) continue;
        for (const type of STAR_AWARD_TYPES) {
            current[type] = detail.awards?.includes(type) ? current[type] + 1 : 0;
            if (current[type] > longest[type]) longest[type] = current[type];
        }
    }
    return longest;
}
