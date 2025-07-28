import { reservedLeagueNames } from './reservedLeagueNames.js';
import { disallowedLeagueNames } from './disallowedLeagueNames.js';

/**
 * Validate if a string is a valid subdomain
 * @param {string} subdomain - The subdomain to validate
 * @returns {boolean} - Whether the subdomain is valid
 */
export function isValidSubdomain(subdomain) {
    if (!subdomain || typeof subdomain !== 'string') return false;

    // Check minimum length (3 characters)
    if (subdomain.length < 3) return false;

    // Check maximum length (63 characters)
    if (subdomain.length > 63) return false;

    // Check characters: alphanumeric and hyphens, but not starting/ending with hyphen
    const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    if (!subdomainRegex.test(subdomain)) return false;

    // Check against reserved names (case-insensitive)
    const lowerSubdomain = subdomain.toLowerCase();
    if (reservedLeagueNames.includes(lowerSubdomain)) return false;

    // Check against disallowed names (case-insensitive)
    if (disallowedLeagueNames.includes(lowerSubdomain)) return false;

    // Check if the subdomain contains any disallowed words
    const containsDisallowed = disallowedLeagueNames.some((word) => lowerSubdomain.includes(word));
    return !containsDisallowed;
}

/**
 * Generate a human-friendly access code
 * @returns {string} - Access code in format XXXX-XXXX-XXXX
 */
export function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const groups = [];

    for (let group = 0; group < 3; group++) {
        let groupCode = '';
        for (let i = 0; i < 4; i++) {
            groupCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        groups.push(groupCode);
    }

    return groups.join('-');
}

/**
 * Configuration for player name validation
 */
const PLAYER_NAME_CONFIG = {
    minLength: 1,
    maxLength: 100, // Support longer names in different scripts

    // Blocklist approach - only block genuinely dangerous characters
    forbiddenPatterns: [
        // HTML/XML tags
        /<[^>]*>/g,

        // JavaScript injection patterns
        /javascript:/gi,
        /on\w+\s*=/gi, // onclick=, onload=, etc.
        /eval\s*\(/gi,
        /expression\s*\(/gi,

        // Control characters (except normal whitespace)
        // eslint-disable-next-line no-control-regex
        /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,

        // Script tags specifically
        /<script[^>]*>.*?<\/script>/gis
    ],

    // Characters that should be completely forbidden (very minimal list)
    forbiddenChars: [
        '\0', // Null byte
        '\x01',
        '\x02',
        '\x03',
        '\x04',
        '\x05',
        '\x06',
        '\x07',
        '\x08',
        '\x0B',
        '\x0C',
        '\x0E',
        '\x0F',
        '\x10',
        '\x11',
        '\x12',
        '\x13',
        '\x14',
        '\x15',
        '\x16',
        '\x17',
        '\x18',
        '\x19',
        '\x1A',
        '\x1B',
        '\x1C',
        '\x1D',
        '\x1E',
        '\x1F',
        '\x7F'
    ]
};

/**
 * Validates and sanitises a player name using inclusive blocklist approach
 * Works on both client and server side
 * @param {string} playerName - The raw player name input
 * @returns {{isValid: boolean, sanitizedName: string, errors: string[]}}
 */
export function validateAndSanitizePlayerName(playerName) {
    const errors = [];

    // Initial type and null checks
    if (typeof playerName !== 'string') {
        return {
            isValid: false,
            sanitizedName: '',
            errors: ['Player name must be text']
        };
    }

    // Trim whitespace
    let sanitized = playerName.trim();

    // Check if empty after trimming
    if (sanitized.length === 0) {
        return {
            isValid: false,
            sanitizedName: '',
            errors: ['Player name cannot be empty']
        };
    }

    // Length validation
    if (sanitized.length < PLAYER_NAME_CONFIG.minLength) {
        errors.push(`Player name must be at least ${PLAYER_NAME_CONFIG.minLength} character long`);
    }

    if (sanitized.length > PLAYER_NAME_CONFIG.maxLength) {
        errors.push(`Player name cannot exceed ${PLAYER_NAME_CONFIG.maxLength} characters`);
        // Truncate if too long
        sanitized = sanitized.substring(0, PLAYER_NAME_CONFIG.maxLength);
    }

    // Remove forbidden control characters
    for (const char of PLAYER_NAME_CONFIG.forbiddenChars) {
        if (sanitized.includes(char)) {
            errors.push('Player name contains invalid characters');
            sanitized = sanitized.replaceAll(char, '');
        }
    }

    // Check and remove forbidden patterns (security)
    for (const pattern of PLAYER_NAME_CONFIG.forbiddenPatterns) {
        if (pattern.test(sanitized)) {
            errors.push('Player name contains potentially unsafe content');
            // Remove forbidden patterns
            sanitized = sanitized.replace(pattern, '');
        }
    }

    // Normalise whitespace - collapse multiple spaces but preserve single spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Final empty check after sanitization
    if (sanitized.length === 0) {
        errors.push('Player name contains only invalid characters');
    }

    // Check for meaningful content (not just punctuation/whitespace)
    if (sanitized.length > 0 && sanitized.replace(/[\s\-_.]/g, '').length === 0) {
        errors.push('Player name must contain letters, numbers, or meaningful characters');
    }

    return {
        isValid: errors.length === 0,
        sanitizedName: sanitized,
        errors
    };
}

/**
 * Client-friendly validation that returns first error for immediate feedback
 * @param {string} playerName - The player name to validate
 * @returns {{isValid: boolean, sanitizedName: string, errorMessage: string}}
 */
export function validatePlayerNameForUI(playerName) {
    const result = validateAndSanitizePlayerName(playerName);

    return {
        isValid: result.isValid,
        sanitizedName: result.sanitizedName,
        errorMessage: result.errors.length > 0 ? result.errors[0] : ''
    };
}

/**
 * API validation utilities for server-side request handling
 */

/**
 * Validates that a date parameter is present in URL search params
 * @param {URLSearchParams} searchParams - URL search parameters
 * @returns {{isValid: boolean, date: string | null, error: string}}
 */
export function validateDateParameter(searchParams) {
    const date = searchParams.get('date');

    if (!date) {
        return {
            isValid: false,
            date: null,
            error: 'Date parameter is required'
        };
    }

    return {
        isValid: true,
        date,
        error: ''
    };
}

/**
 * Safely parses JSON request body with consistent error handling
 * @param {Request} request - The request object
 * @returns {Promise<{isValid: boolean, data: any, error: string}>}
 */
export async function parseRequestBody(request) {
    try {
        const data = await request.json();

        if (!data || typeof data !== 'object') {
            return {
                isValid: false,
                data: null,
                error: 'Request body must be a valid JSON object'
            };
        }

        return {
            isValid: true,
            data,
            error: ''
        };
    } catch {
        return {
            isValid: false,
            data: null,
            error: 'Invalid JSON payload'
        };
    }
}

/**
 * Validates request body structure and required fields
 * @param {Record<string, any>} body - Request body to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateRequestBody(body, requiredFields = []) {
    const errors = [];

    if (!body || typeof body !== 'object') {
        return {
            isValid: false,
            errors: ['Request body must be a valid JSON object']
        };
    }

    // Check for required fields
    for (const field of requiredFields) {
        if (!(field in body) || body[field] === null || body[field] === undefined) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates a list parameter (available, waitingList)
 * @param {string} list - The list identifier
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateList(list) {
    const validLists = ['available', 'waitingList'];
    const errors = [];

    if (typeof list !== 'string') {
        errors.push('List must be a string');
    } else if (!validLists.includes(list)) {
        errors.push(`List must be one of: ${validLists.join(', ')}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates required fields are present and non-empty
 * @param {Record<string, any>} data - Data object to validate
 * @param {Array<string>} fields - Array of required field names
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateRequiredFields(data, fields) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Data must be a valid object']
        };
    }

    for (const field of fields) {
        const value = data[field];
        if (
            value === null ||
            value === undefined ||
            (typeof value === 'string' && value.trim() === '')
        ) {
            errors.push(`${field} is required`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
