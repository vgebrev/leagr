import { readFileSync, existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isValidSubdomain } from '$lib/shared/validation.js';

/**
 * Custom error class that preserves HTTP status codes
 */

export class LeagueError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'LeagueError';
        this.statusCode = statusCode;
    }
}

/**
 * Check if a league exists by verifying the info.json file
 * @param {string} leagueId - The league id (null for default league)
 * @returns {boolean} - Whether the league exists
 */
export function leagueExists(leagueId) {
    // Default league (no subdomain) always exists
    if (!leagueId) return true;

    const infoPath = join(process.cwd(), 'data', leagueId, 'info.json');
    return existsSync(infoPath);
}

/**
 * Get league information from info.json
 * @param {string} leagueId - The league name
 * @returns {Object|null} - League info object or null if not found
 */
export function getLeagueInfo(leagueId) {
    if (!leagueId || !leagueExists(leagueId)) return null;

    try {
        const infoPath = join(process.cwd(), 'data', leagueId, 'info.json');
        const data = readFileSync(infoPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading league info for ${leagueId}:`, error);
        return null;
    }
}

/**
 * Get the data directory path for a league
 * @param {string} leagueId - The league name (null for default)
 * @returns {string} - The data directory path
 */
export function getLeagueDataPath(leagueId) {
    if (!leagueId) {
        // Default league uses the root data directory
        return join(process.cwd(), 'data');
    }

    return join(process.cwd(), 'data', leagueId);
}

/**
 * League service class for managing league operations
 */
export class LeagueService {
    /**
     * Create a new league
     * @param {Object} leagueData - League creation data
     * @param {string} leagueData.subdomain - League subdomain
     * @param {string} leagueData.name - League name
     * @param {string} leagueData.icon - League icon
     * @param {string} leagueData.accessCode - League access code
     * @param {string} [leagueData.ownerEmail] - Optional owner email
     * @returns {Promise<Object>} - Success response with league data
     * @throws {LeagueError} - Validation or creation errors
     */
    async createLeague({ subdomain, name, icon, accessCode, ownerEmail }) {
        // Validate required fields
        if (!subdomain || !name || !icon || !accessCode) {
            throw new LeagueError(
                'Missing required fields: subdomain, name, icon, accessCode',
                400
            );
        }

        // Validate subdomain
        if (!isValidSubdomain(subdomain)) {
            throw new LeagueError(
                'Invalid subdomain format. Use only letters, numbers, and hyphens.',
                400
            );
        }

        // Check if league already exists
        const leagueDataPath = join(process.cwd(), 'data', subdomain);
        const infoPath = join(leagueDataPath, 'info.json');

        if (existsSync(infoPath)) {
            throw new LeagueError('League already exists', 409);
        }

        // Create league directory and info file
        await mkdir(leagueDataPath, { recursive: true });

        const leagueInfo = {
            id: subdomain,
            name,
            icon,
            accessCode,
            ...(ownerEmail && { ownerEmail })
        };

        await writeFile(infoPath, JSON.stringify(leagueInfo, null, 2));

        return {
            success: true,
            message: 'League created successfully',
            league: { subdomain, name, icon }
        };
    }
}

// Export factory function to create new instance per request
export const createLeagueService = () => new LeagueService();

/**
 * Validate league exists for API requests
 * @param {Object} locals - SvelteKit locals object
 * @returns {Object} - { leagueId, isValid }
 */
export function validateLeagueForAPI(locals) {
    const leagueInfo = locals.leagueInfo;

    // If no league info (root domain or non-existent league), not valid for data APIs
    if (!leagueInfo) {
        return { leagueId: null, isValid: false };
    }

    // Get league ID from the stored league info
    const leagueId = leagueInfo.id;

    return { leagueId, isValid: true };
}
