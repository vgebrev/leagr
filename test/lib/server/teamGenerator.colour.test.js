import { describe, it, expect, vi, afterEach } from 'vitest';

// The noun pool is file-backed and irrelevant to colour assignment; stub it so the
// test stays in-memory and deterministic.
vi.mock('$lib/server/nounPool.js', () => ({
    getNextNouns: vi.fn(async (count) => Array.from({ length: count }, (_, i) => `noun${i}`))
}));

const { createTeamGenerator } = await import('$lib/server/teamGenerator.js');
const { teamColours } = await import('$lib/shared/helpers.js');

/**
 * Deterministic PRNG (mulberry32) so the statistics below are fixed, not flaky.
 * @param {number} seed
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Draw `runs` sets of team names and return the colour in each team slot.
 * @param {number} teams
 * @param {number} runs
 * @param {number} seed
 * @returns {Promise<string[][]>}
 */
async function drawColours(teams, runs, seed) {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
    const generator = createTeamGenerator().setLeague('test-league');
    const draws = [];
    for (let i = 0; i < runs; i++) {
        const names = await generator.generateTeamNames(teams);
        draws.push(names.map((name) => name.split(' ')[0]));
    }
    return draws;
}

describe('TeamGenerator colour distribution', () => {
    afterEach(() => vi.restoreAllMocks());

    it('uses each of the first N colours exactly once per draw', async () => {
        for (const teams of [3, 4, 5]) {
            const expected = teamColours.slice(0, teams);
            for (const draw of await drawColours(teams, 200, 7 + teams)) {
                expect([...draw].sort()).toEqual([...expected].sort());
            }
            vi.restoreAllMocks();
        }
    });

    // Regression guard for the `sort(() => Math.random() - 0.5)` shuffle used between
    // 2025-08-02 and 2026-04-18. That shuffle is not permutation-uniform: under V8 it
    // returns the identity ~18.8% of the time and its reverse ~17.1%, against 4.17%
    // for a fair shuffle. Only a test over whole permutations catches that.
    it('assigns colours to team slots with a permutation-uniform shuffle', async () => {
        const RUNS = 12_000;
        const counts = new Map();
        for (const draw of await drawColours(4, RUNS, 20260419)) {
            const key = draw.join('-');
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        expect(counts.size).toBe(24); // 4! permutations all reachable

        const expectedPerPermutation = RUNS / 24;
        let chiSquare = 0;
        for (const observed of counts.values()) {
            chiSquare += (observed - expectedPerPermutation) ** 2 / expectedPerPermutation;
        }
        // df = 23, critical value at p = 0.001. The broken shuffle scores in the thousands.
        expect(chiSquare).toBeLessThan(49.73);
    });

    it('assigns every colour to every team slot equally often', async () => {
        const RUNS = 12_000;
        const palette = teamColours.slice(0, 4);
        const table = palette.map(() => palette.map(() => 0));
        for (const draw of await drawColours(4, RUNS, 5150)) {
            draw.forEach((colour, slot) => table[slot][palette.indexOf(colour)]++);
        }

        // Each draw contributes one observation per slot, so every row totals RUNS.
        const expectedPerCell = RUNS / palette.length;
        let chiSquare = 0;
        for (const row of table) {
            for (const observed of row) {
                chiSquare += (observed - expectedPerCell) ** 2 / expectedPerCell;
            }
        }
        // df = 9, critical value at p = 0.001.
        expect(chiSquare).toBeLessThan(27.88);
    });
});
