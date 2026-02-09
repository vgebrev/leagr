import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getNextNouns, getNounPoolStatus, resetNounPool } from '$lib/server/nounPool.js';
import { nouns } from '$lib/shared/nouns.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_LEAGUE_ID = 'test-noun-pool';
const DATA_DIR = process.env.DATA_DIR || 'data';
const TEST_LEAGUE_DIR = join(DATA_DIR, TEST_LEAGUE_ID);

describe('nounPool', () => {
    beforeEach(() => {
        // Clean up test league directory before each test
        if (existsSync(TEST_LEAGUE_DIR)) {
            rmSync(TEST_LEAGUE_DIR, { recursive: true, force: true });
        }
        mkdirSync(TEST_LEAGUE_DIR, { recursive: true });
    });

    afterEach(() => {
        // Clean up after tests
        if (existsSync(TEST_LEAGUE_DIR)) {
            rmSync(TEST_LEAGUE_DIR, { recursive: true, force: true });
        }
    });

    describe('getNextNouns', () => {
        it('should throw error if leagueId is not provided', async () => {
            await expect(getNextNouns(3, null)).rejects.toThrow(
                'leagueId is required for noun pool operations'
            );
        });

        it('should return empty array when count is 0', async () => {
            const result = await getNextNouns(0, TEST_LEAGUE_ID);
            expect(result).toEqual([]);
        });

        it('should return requested number of nouns on first call', async () => {
            const result = await getNextNouns(5, TEST_LEAGUE_ID);
            expect(result).toHaveLength(5);
            expect(result.every((noun) => nouns.includes(noun))).toBe(true);
        });

        it('should return unique nouns within the same request', async () => {
            const result = await getNextNouns(10, TEST_LEAGUE_ID);
            const uniqueNouns = new Set(result);
            expect(uniqueNouns.size).toBe(10);
        });

        it('should return sequential nouns from shuffled pool', async () => {
            const batch1 = await getNextNouns(3, TEST_LEAGUE_ID);
            const batch2 = await getNextNouns(2, TEST_LEAGUE_ID);

            // All should be unique across batches
            const combined = [...batch1, ...batch2];
            const uniqueNouns = new Set(combined);
            expect(uniqueNouns.size).toBe(5);
        });

        it('should exhaust pool before repeating any noun', async () => {
            const totalNouns = nouns.length;
            const usedNouns = new Set();

            // Request all nouns one at a time
            for (let i = 0; i < totalNouns; i++) {
                const [noun] = await getNextNouns(1, TEST_LEAGUE_ID);
                usedNouns.add(noun);
            }

            // All nouns should have been used exactly once
            expect(usedNouns.size).toBe(totalNouns);
        });

        it('should reshuffle when pool is exhausted', async () => {
            const totalNouns = nouns.length;

            // Get all nouns from first cycle
            const firstCycle = await getNextNouns(totalNouns, TEST_LEAGUE_ID);
            expect(firstCycle).toHaveLength(totalNouns);

            // Get nouns from second cycle (should be reshuffled)
            const secondCycle = await getNextNouns(5, TEST_LEAGUE_ID);
            expect(secondCycle).toHaveLength(5);

            // Second cycle nouns should all be valid
            expect(secondCycle.every((noun) => nouns.includes(noun))).toBe(true);

            // Check that cycle count increased
            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.cycleCount).toBe(1);
        });

        it('should handle reshuffle mid-request when pool runs out', async () => {
            const totalNouns = nouns.length;

            // Exhaust most of the pool
            await getNextNouns(totalNouns - 2, TEST_LEAGUE_ID);

            // Request more than remaining (should trigger reshuffle mid-request)
            const result = await getNextNouns(5, TEST_LEAGUE_ID);
            expect(result).toHaveLength(5);
            expect(result.every((noun) => nouns.includes(noun))).toBe(true);

            // Should have cycled
            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.cycleCount).toBe(1);
            expect(status.currentIndex).toBe(3); // 2 from old cycle + 3 from new cycle = 5 total
        });

        it('should maintain separate pools for different leagues', async () => {
            const league1 = 'league-1';
            const league2 = 'league-2';

            const league1Dir = join(DATA_DIR, league1);
            const league2Dir = join(DATA_DIR, league2);

            try {
                // Get nouns for both leagues
                await getNextNouns(5, league1);
                await getNextNouns(5, league2);

                // Check their statuses are independent
                const status1 = await getNounPoolStatus(league1);
                const status2 = await getNounPoolStatus(league2);

                expect(status1.currentIndex).toBe(5);
                expect(status2.currentIndex).toBe(5);

                // Advance league 1 only
                await getNextNouns(10, league1);

                const newStatus1 = await getNounPoolStatus(league1);
                const newStatus2 = await getNounPoolStatus(league2);

                expect(newStatus1.currentIndex).toBe(15);
                expect(newStatus2.currentIndex).toBe(5); // Should not have changed
            } finally {
                // Clean up
                if (existsSync(league1Dir)) {
                    rmSync(league1Dir, { recursive: true, force: true });
                }
                if (existsSync(league2Dir)) {
                    rmSync(league2Dir, { recursive: true, force: true });
                }
            }
        });

        it('should handle concurrent requests with mutex protection', async () => {
            // Make multiple concurrent requests
            const promises = [
                getNextNouns(3, TEST_LEAGUE_ID),
                getNextNouns(4, TEST_LEAGUE_ID),
                getNextNouns(2, TEST_LEAGUE_ID)
            ];

            const results = await Promise.all(promises);

            // Flatten results
            const allNouns = results.flat();
            expect(allNouns).toHaveLength(9);

            // All should be unique (no race conditions)
            const uniqueNouns = new Set(allNouns);
            expect(uniqueNouns.size).toBe(9);

            // Current index should be exactly 9
            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.currentIndex).toBe(9);
        });

        it('should create league directory if it does not exist', async () => {
            const newLeague = 'new-test-league';
            const newLeagueDir = join(DATA_DIR, newLeague);

            try {
                // Ensure it doesn't exist
                if (existsSync(newLeagueDir)) {
                    rmSync(newLeagueDir, { recursive: true, force: true });
                }

                // Get nouns for new league
                const result = await getNextNouns(3, newLeague);
                expect(result).toHaveLength(3);

                // Directory should now exist
                expect(existsSync(newLeagueDir)).toBe(true);
            } finally {
                // Clean up
                if (existsSync(newLeagueDir)) {
                    rmSync(newLeagueDir, { recursive: true, force: true });
                }
            }
        });
    });

    describe('getNounPoolStatus', () => {
        it('should throw error if leagueId is not provided', async () => {
            await expect(getNounPoolStatus(null)).rejects.toThrow(
                'leagueId is required for noun pool operations'
            );
        });

        it('should return initial status for new league', async () => {
            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status).toMatchObject({
                currentIndex: 0,
                totalNouns: nouns.length,
                cycleCount: 0,
                percentUsed: 0
            });
        });

        it('should return correct status after using some nouns', async () => {
            await getNextNouns(50, TEST_LEAGUE_ID);

            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.currentIndex).toBe(50);
            expect(status.totalNouns).toBe(nouns.length);
            expect(status.cycleCount).toBe(0);
            expect(status.percentUsed).toBe(Math.round((50 / nouns.length) * 100));
        });

        it('should show cycle count after pool exhaustion', async () => {
            const totalNouns = nouns.length;

            // Exhaust pool twice
            await getNextNouns(totalNouns, TEST_LEAGUE_ID);
            await getNextNouns(totalNouns, TEST_LEAGUE_ID);

            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.cycleCount).toBe(1);
            expect(status.currentIndex).toBe(totalNouns);
            expect(status.percentUsed).toBe(100);
        });

        it('should show correct percent used', async () => {
            const totalNouns = nouns.length;
            const halfNouns = Math.floor(totalNouns / 2);

            await getNextNouns(halfNouns, TEST_LEAGUE_ID);

            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.percentUsed).toBeGreaterThanOrEqual(49);
            expect(status.percentUsed).toBeLessThanOrEqual(51);
        });
    });

    describe('resetNounPool', () => {
        it('should throw error if leagueId is not provided', async () => {
            await expect(resetNounPool(null)).rejects.toThrow(
                'leagueId is required for noun pool operations'
            );
        });

        it('should reset pool to initial state', async () => {
            // Use some nouns
            await getNextNouns(50, TEST_LEAGUE_ID);

            let status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.currentIndex).toBe(50);

            // Reset
            await resetNounPool(TEST_LEAGUE_ID);

            // Check status after reset
            status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.currentIndex).toBe(0);
            expect(status.cycleCount).toBe(0);
            expect(status.percentUsed).toBe(0);
        });

        it('should reshuffle nouns on reset', async () => {
            // Get first batch
            const batch1 = await getNextNouns(10, TEST_LEAGUE_ID);

            // Reset
            await resetNounPool(TEST_LEAGUE_ID);

            // Get second batch after reset
            const batch2 = await getNextNouns(10, TEST_LEAGUE_ID);

            // Both should be valid
            expect(batch1).toHaveLength(10);
            expect(batch2).toHaveLength(10);

            // They should likely be different (not guaranteed but extremely probable)
            // We can at least verify they're both valid noun sets
            expect(batch1.every((noun) => nouns.includes(noun))).toBe(true);
            expect(batch2.every((noun) => nouns.includes(noun))).toBe(true);
        });

        it('should reset cycle count', async () => {
            const totalNouns = nouns.length;

            // Complete multiple cycles
            await getNextNouns(totalNouns * 2 + 50, TEST_LEAGUE_ID);

            let status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.cycleCount).toBeGreaterThan(0);

            // Reset
            await resetNounPool(TEST_LEAGUE_ID);

            // Cycle count should be 0
            status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.cycleCount).toBe(0);
        });
    });

    describe('File corruption handling', () => {
        it('should reinitialize pool if file is corrupted', async () => {
            const { writeFileSync } = await import('fs');
            const poolPath = join(TEST_LEAGUE_DIR, 'noun-pool.json');

            // Create corrupted file
            writeFileSync(poolPath, '{ invalid json', 'utf-8');

            // Should still work (reinitializes)
            const result = await getNextNouns(5, TEST_LEAGUE_ID);
            expect(result).toHaveLength(5);
            expect(result.every((noun) => nouns.includes(noun))).toBe(true);
        });

        it('should reinitialize pool if structure is invalid', async () => {
            const { writeFileSync } = await import('fs');
            const poolPath = join(TEST_LEAGUE_DIR, 'noun-pool.json');

            // Create file with invalid structure
            writeFileSync(poolPath, JSON.stringify({ invalid: 'structure' }), 'utf-8');

            // Should still work (reinitializes)
            const result = await getNextNouns(5, TEST_LEAGUE_ID);
            expect(result).toHaveLength(5);
            expect(result.every((noun) => nouns.includes(noun))).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should handle requesting all nouns at once', async () => {
            const totalNouns = nouns.length;
            const result = await getNextNouns(totalNouns, TEST_LEAGUE_ID);

            expect(result).toHaveLength(totalNouns);
            expect(new Set(result).size).toBe(totalNouns);

            // Should have used entire pool
            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.currentIndex).toBe(totalNouns);
            expect(status.percentUsed).toBe(100);
        });

        it('should handle requesting more nouns than exist in pool', async () => {
            const totalNouns = nouns.length;
            const result = await getNextNouns(totalNouns + 50, TEST_LEAGUE_ID);

            expect(result).toHaveLength(totalNouns + 50);
            expect(result.every((noun) => nouns.includes(noun))).toBe(true);

            // Should have cycled
            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.cycleCount).toBe(1);
            expect(status.currentIndex).toBe(50);
        });

        it('should handle very large requests', async () => {
            const totalNouns = nouns.length;
            const largeCount = totalNouns * 5 + 17;

            const result = await getNextNouns(largeCount, TEST_LEAGUE_ID);

            expect(result).toHaveLength(largeCount);
            expect(result.every((noun) => nouns.includes(noun))).toBe(true);

            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.cycleCount).toBe(5);
            expect(status.currentIndex).toBe(17);
        });

        it('should handle single noun requests efficiently', async () => {
            const result1 = await getNextNouns(1, TEST_LEAGUE_ID);
            const result2 = await getNextNouns(1, TEST_LEAGUE_ID);
            const result3 = await getNextNouns(1, TEST_LEAGUE_ID);

            expect(result1).toHaveLength(1);
            expect(result2).toHaveLength(1);
            expect(result3).toHaveLength(1);

            // All should be different (sequential from shuffled pool)
            const combined = [...result1, ...result2, ...result3];
            expect(new Set(combined).size).toBe(3);

            const status = await getNounPoolStatus(TEST_LEAGUE_ID);
            expect(status.currentIndex).toBe(3);
        });
    });
});
