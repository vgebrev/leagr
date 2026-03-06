/**
 * Find a league match using 1-indexed round and match URL params.
 * @param {Array<Array<Object>>} rounds
 * @param {string|null} roundParam - 1-indexed round number
 * @param {string|null} matchParam - 1-indexed match position within round
 * @returns {Object|null}
 */
export function findLeagueMatch(rounds, roundParam, matchParam) {
    if (!rounds || !roundParam || !matchParam) return null;
    const roundIndex = parseInt(roundParam, 10) - 1;
    const matchIndex = parseInt(matchParam, 10) - 1;
    if (roundIndex < 0 || matchIndex < 0) return null;
    return rounds[roundIndex]?.[matchIndex] ?? null;
}

/**
 * Find a knockout match by round name and match number.
 * @param {Object|null} bracket - Knockout bracket object (has .bracket array)
 * @param {string|null} roundParam - Round name e.g. 'quarter', 'semi', 'final'
 * @param {string|null} matchParam - Match number as string
 * @returns {Object|null}
 */
export function findKnockoutMatch(bracket, roundParam, matchParam) {
    if (!bracket?.bracket || !roundParam || !matchParam) return null;
    const matchNumber = parseInt(matchParam, 10);
    return bracket.bracket.find((m) => m.round === roundParam && m.match === matchNumber) ?? null;
}

/**
 * Update an action count for a player, removing the key when the count reaches zero.
 * @param {Record<string, number>|null|undefined} actions
 * @param {string} playerName
 * @param {number} delta - +1 or -1
 * @returns {Record<string, number>|null}
 */
export function updateActionCount(actions, playerName, delta) {
    const updated = { ...(actions || {}) };
    const newCount = (updated[playerName] || 0) + delta;
    if (newCount > 0) {
        updated[playerName] = newCount;
    } else {
        delete updated[playerName];
    }
    return Object.keys(updated).length > 0 ? updated : null;
}
