import { rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Global teardown that runs after all tests complete.
 * Cleans up any test data directories that may have been created.
 */
export default async function globalTeardown() {
    const DATA_DIR = process.env.DATA_DIR || 'data';

    // Only clean up if DATA_DIR exists
    if (!existsSync(DATA_DIR)) {
        return;
    }

    try {
        const entries = readdirSync(DATA_DIR);

        // Patterns for test leagues that should be cleaned up
        const testPatterns = [
            /^test-/i, // Anything starting with "test-"
            /^league-\d+$/i, // league-1, league-2, etc. (from tests)
            /^new-test-/i // new-test-league from tests
        ];

        // Remove test directories
        for (const entry of entries) {
            const shouldDelete = testPatterns.some((pattern) => pattern.test(entry));

            if (shouldDelete) {
                const fullPath = join(DATA_DIR, entry);
                try {
                    rmSync(fullPath, { recursive: true, force: true });
                    // Using console.warn for cleanup messages (console.log not allowed by linter)
                    console.warn(`✓ Cleaned up test data: ${entry}`);
                } catch (err) {
                    console.warn(`Failed to clean up ${entry}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.warn('Error during test cleanup:', err.message);
    }
}
