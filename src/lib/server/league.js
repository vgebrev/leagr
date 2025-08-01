import { readFileSync, writeFileSync, existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { isValidSubdomain } from '$lib/shared/validation.js';

/**
 * Custom error class that preserves HTTP status codes
 */

export class LeagueError extends Error {
    /**
     * @param {string} message
     * @param {number} statusCode
     */
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
 * Update league info file
 * @param {string} leagueId - The league identifier
 * @param {Object} leagueInfo - The updated league info object
 * @returns {boolean} - Success status
 */
export function updateLeagueInfo(leagueId, leagueInfo) {
    if (!leagueId) {
        console.error('League ID is required for updating league info');
        return false;
    }

    try {
        const infoPath = join(process.cwd(), 'data', leagueId, 'info.json');
        const data = JSON.stringify(leagueInfo, null, 2);
        writeFileSync(infoPath, data, 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error updating league info for ${leagueId}:`, error);
        return false;
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

        // Check if a league already exists
        const leagueDataPath = join(process.cwd(), 'data', subdomain);
        const infoPath = join(leagueDataPath, 'info.json');

        if (existsSync(infoPath)) {
            throw new LeagueError('League already exists', 409);
        }

        // Create a league directory and info file
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

    /**
     * Generate and send a reset code for forgotten access codes
     * @param {string} leagueId - The league identifier
     * @param {Object} leagueInfo - The league info object
     * @param {string} email - The email address to send to
     * @returns {Promise<Object>} - Success response
     * @throws {LeagueError} - Validation or operation errors
     */
    async generateAccessCodeReset(leagueId, leagueInfo, email) {
        if (!email || typeof email !== 'string' || !email.trim()) {
            throw new LeagueError('Email is required', 400);
        }

        // Check if the league has owner email configured
        if (!leagueInfo.ownerEmail) {
            throw new LeagueError('No owner email configured for this league', 400);
        }

        // Check if email matches owner email
        if (leagueInfo.ownerEmail.toLowerCase() !== email.toLowerCase()) {
            // Don't throw error for security - just return success
            return {
                success: true,
                message: 'A reset link has been sent to the league organiser email.'
            };
        }

        // Generate reset code and set expiry (1 hour from now)
        const { generateAccessCode } = await import('$lib/shared/validation.js');
        const resetCode = generateAccessCode();
        const resetCodeExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        // Update league info with reset code
        const updatedLeagueInfo = {
            ...leagueInfo,
            resetCode,
            resetCodeExpiry
        };

        const updateSuccess = updateLeagueInfo(leagueId, updatedLeagueInfo);
        if (!updateSuccess) {
            throw new LeagueError('Failed to generate reset code', 500);
        }

        // Send the reset email
        const { sendAccessCodeResetEmail } = await import('$lib/server/email.js');
        const emailSent = await sendAccessCodeResetEmail(
            email,
            leagueId,
            leagueInfo.name,
            resetCode
        );

        if (emailSent) {
            console.warn(`Reset code generated and email sent for league ${leagueId}`);
        } else {
            console.error(`Failed to send reset email for league ${leagueId}`);
        }

        return {
            success: true,
            message: 'A reset link has been sent to the league organiser email.'
        };
    }

    /**
     * Validate a reset code
     * @param {Object} leagueInfo - The league info object
     * @param {string} resetCode - The reset code to validate
     * @returns {Object} - Validation result
     * @throws {LeagueError} - Validation errors
     */
    validateResetCode(leagueInfo, resetCode) {
        if (!resetCode || typeof resetCode !== 'string' || !resetCode.trim()) {
            throw new LeagueError('Reset code is required', 400);
        }

        // Check if reset code exists and is valid
        if (!leagueInfo.resetCode || !leagueInfo.resetCodeExpiry) {
            throw new LeagueError('No reset code found', 400);
        }

        // Check if reset code matches
        if (leagueInfo.resetCode !== resetCode.trim()) {
            throw new LeagueError('Invalid reset code', 400);
        }

        // Check if reset code has expired
        const now = new Date();
        const expiryDate = new Date(leagueInfo.resetCodeExpiry);

        if (now > expiryDate) {
            throw new LeagueError('Reset code has expired', 400);
        }

        return {
            success: true,
            message: 'Reset code is valid'
        };
    }

    /**
     * Reset access code using a valid reset code
     * @param {string} leagueId - The league identifier
     * @param {Object} leagueInfo - The league info object
     * @param {string} resetCode - The reset code for validation
     * @param {string} newAccessCode - The new access code to set
     * @returns {Object} - Success response
     * @throws {LeagueError} - Validation or operation errors
     */
    resetAccessCode(leagueId, leagueInfo, resetCode, newAccessCode) {
        if (!resetCode || typeof resetCode !== 'string' || !resetCode.trim()) {
            throw new LeagueError('Reset code is required', 400);
        }

        if (!newAccessCode || typeof newAccessCode !== 'string' || !newAccessCode.trim()) {
            throw new LeagueError('New access code is required', 400);
        }

        // Validate reset code first
        this.validateResetCode(leagueInfo, resetCode);

        // Update league info with new access code and remove reset code
        const updatedLeagueInfo = {
            ...leagueInfo,
            accessCode: newAccessCode.trim(),
            resetCode: undefined,
            resetCodeExpiry: undefined
        };

        const updateSuccess = updateLeagueInfo(leagueId, updatedLeagueInfo);
        if (!updateSuccess) {
            throw new LeagueError('Failed to update access code', 500);
        }

        console.warn(`Access code updated for league ${leagueId}`);

        return {
            success: true,
            message: 'Access code updated successfully'
        };
    }
}

// Export factory function to create a new instance per request
export const createLeagueService = () => new LeagueService();

/**
 * Validate league exists for API requests
 * @param {Record<string, any>} locals - SvelteKit locals object
 * @returns {{leagueId: string|null, isValid: boolean}} - { leagueId, isValid }
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
