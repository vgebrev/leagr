import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Mutex } from 'async-mutex';
import { nouns } from '$lib/shared/nouns.js';

const DATA_DIR = process.env.DATA_DIR || 'data';
const mutex = new Mutex();

/**
 * @typedef {Object} NounPool
 * @property {string[]} shuffledNouns - Shuffled array of all available nouns
 * @property {number} currentIndex - Current position in the shuffled array
 * @property {number} cycleCount - Number of times the pool has been reshuffled
 */

/**
 * @typedef {Object} NounPoolStatus
 * @property {number} currentIndex - Current position in the pool
 * @property {number} totalNouns - Total number of nouns in the pool
 * @property {number} cycleCount - Number of complete cycles through the pool
 * @property {number} percentUsed - Percentage of current cycle used (0-100)
 */

/**
 * Get the noun pool file path for a league
 * @param {string} leagueId - League identifier
 * @returns {string} File path to noun pool JSON
 */
function getNounPoolPath(leagueId) {
    return join(DATA_DIR, leagueId, 'noun-pool.json');
}

/**
 * Load the noun pool state for a league
 * @param {string} leagueId - League identifier
 * @returns {NounPool} Noun pool state
 */
function loadNounPool(leagueId) {
    const filePath = getNounPoolPath(leagueId);

    if (!existsSync(filePath)) {
        // Initialize with shuffled nouns
        return {
            shuffledNouns: [...nouns].sort(() => Math.random() - 0.5),
            currentIndex: 0,
            cycleCount: 0
        };
    }

    try {
        const content = readFileSync(filePath, 'utf-8');
        const pool = JSON.parse(content);

        // Validate structure
        if (
            !pool ||
            !Array.isArray(pool.shuffledNouns) ||
            typeof pool.currentIndex !== 'number' ||
            typeof pool.cycleCount !== 'number'
        ) {
            throw new Error('Invalid noun pool structure');
        }

        return pool;
    } catch {
        // If file is corrupted or invalid, reinitialize
        return {
            shuffledNouns: [...nouns].sort(() => Math.random() - 0.5),
            currentIndex: 0,
            cycleCount: 0
        };
    }
}

/**
 * Save the noun pool state for a league
 * @param {string} leagueId - League identifier
 * @param {NounPool} pool - Noun pool state to save
 */
function saveNounPool(leagueId, pool) {
    const leagueDir = join(DATA_DIR, leagueId);

    // Ensure league directory exists
    if (!existsSync(leagueDir)) {
        mkdirSync(leagueDir, { recursive: true });
    }

    const filePath = getNounPoolPath(leagueId);
    writeFileSync(filePath, JSON.stringify(pool, null, 2), 'utf-8');
}

/**
 * Get the next N nouns from the pool, reshuffling when exhausted
 * This ensures all nouns are used before any repetitions occur.
 *
 * @param {number} count - Number of nouns needed
 * @param {string} leagueId - League identifier
 * @returns {Promise<string[]>} Array of nouns
 */
export async function getNextNouns(count, leagueId) {
    if (!leagueId) {
        throw new Error('leagueId is required for noun pool operations');
    }

    if (count <= 0) {
        return [];
    }

    return await mutex.runExclusive(() => {
        let pool = loadNounPool(leagueId);
        const selectedNouns = [];

        for (let i = 0; i < count; i++) {
            // Check if we need to reshuffle
            if (pool.currentIndex >= pool.shuffledNouns.length) {
                pool.shuffledNouns = [...nouns].sort(() => Math.random() - 0.5);
                pool.currentIndex = 0;
                pool.cycleCount++;
            }

            selectedNouns.push(pool.shuffledNouns[pool.currentIndex]);
            pool.currentIndex++;
        }

        saveNounPool(leagueId, pool);
        return selectedNouns;
    });
}

/**
 * Get the current state of the noun pool (for debugging/analytics)
 * @param {string} leagueId - League identifier
 * @returns {Promise<NounPoolStatus>} Current pool status
 */
export async function getNounPoolStatus(leagueId) {
    if (!leagueId) {
        throw new Error('leagueId is required for noun pool operations');
    }

    return await mutex.runExclusive(() => {
        const pool = loadNounPool(leagueId);
        return {
            currentIndex: pool.currentIndex,
            totalNouns: pool.shuffledNouns.length,
            cycleCount: pool.cycleCount,
            percentUsed: Math.round((pool.currentIndex / pool.shuffledNouns.length) * 100)
        };
    });
}

/**
 * Reset the noun pool (useful for testing or manual resets)
 * @param {string} leagueId - League identifier
 * @returns {Promise<void>}
 */
export async function resetNounPool(leagueId) {
    if (!leagueId) {
        throw new Error('leagueId is required for noun pool operations');
    }

    return await mutex.runExclusive(() => {
        const pool = {
            shuffledNouns: [...nouns].sort(() => Math.random() - 0.5),
            currentIndex: 0,
            cycleCount: 0
        };
        saveNounPool(leagueId, pool);
    });
}
