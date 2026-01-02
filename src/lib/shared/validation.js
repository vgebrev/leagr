import { reservedLeagueNames } from './reservedLeagueNames.js';
import { disallowedLeagueNames } from './disallowedLeagueNames.js';
import { isCompetitionEnded } from './helpers.js';

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

    // Final empty check after sanitising
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

/**
 * Game score validation configuration
 */
const GAME_SCORE_CONFIG = {
    minScore: 0,
    maxScore: 99,
    allowNull: true // For unplayed games
};

/**
 * Validates an individual game score
 * @param {string|number|null} score - The score to validate
 * @param {string} scoreType - Type of score for error messages (e.g., 'home', 'away')
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateGameScore(score, scoreType = 'score') {
    const errors = [];

    // Allow null scores for unplayed games
    if (score === null || score === undefined) {
        return {
            isValid: GAME_SCORE_CONFIG.allowNull,
            errors: GAME_SCORE_CONFIG.allowNull ? [] : [`${scoreType} score is required`]
        };
    }

    // Check if it's a number
    if (typeof score !== 'number') {
        // Try to parse if it's a string number
        if (typeof score === 'string' && score.trim() !== '') {
            const parsed = parseInt(score.trim(), 10);
            if (isNaN(parsed)) {
                errors.push(`${scoreType} score must be a valid number`);
                return { isValid: false, errors };
            }
            score = parsed;
        } else {
            errors.push(`${scoreType} score must be a valid number`);
            return { isValid: false, errors };
        }
    }

    // Check if it's an integer
    if (!Number.isInteger(score)) {
        errors.push(`${scoreType} score must be a whole number`);
    }

    // Check range
    if (score < GAME_SCORE_CONFIG.minScore) {
        errors.push(`${scoreType} score cannot be less than ${GAME_SCORE_CONFIG.minScore}`);
    }

    if (score > GAME_SCORE_CONFIG.maxScore) {
        errors.push(`${scoreType} score cannot exceed ${GAME_SCORE_CONFIG.maxScore}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates a complete match with home and away scores
 * @param {Object} match - Match object with homeScore and awayScore
 * @returns {{isValid: boolean, errors: string[], sanitizedMatch: Object}}
 */
export function validateMatchScores(match) {
    const errors = [];
    let sanitizedMatch = { ...match };

    if (!match || typeof match !== 'object') {
        return {
            isValid: false,
            errors: ['Match must be a valid object'],
            sanitizedMatch: null
        };
    }

    // Validate home score
    const homeResult = validateGameScore(match.homeScore, 'Home');
    if (!homeResult.isValid) {
        errors.push(...homeResult.errors);
    } else if (match.homeScore !== null && match.homeScore !== undefined) {
        // Sanitise by converting to integer if valid
        sanitizedMatch.homeScore = parseInt(match.homeScore, 10);
    }

    // Validate away score
    const awayResult = validateGameScore(match.awayScore, 'Away');
    if (!awayResult.isValid) {
        errors.push(...awayResult.errors);
    } else if (match.awayScore !== null && match.awayScore !== undefined) {
        // Sanitise by converting to integer if valid
        sanitizedMatch.awayScore = parseInt(match.awayScore, 10);
    }

    // Check logical consistency - both scores should be null, or both should be numbers
    const homeIsNull = match.homeScore === null || match.homeScore === undefined;
    const awayIsNull = match.awayScore === null || match.awayScore === undefined;

    if (homeIsNull !== awayIsNull) {
        errors.push('Both home and away scores must be provided, or both must be empty');
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitizedMatch
    };
}

/**
 * Validates a round of matches
 * @param {Array} round - Array of match objects
 * @param {number} roundIndex - Round number for error context
 * @returns {{isValid: boolean, errors: string[], sanitizedRound: Array}}
 */
export function validateRound(round, roundIndex = 0) {
    const errors = [];
    const sanitizedRound = [];

    if (!Array.isArray(round)) {
        return {
            isValid: false,
            errors: [`Round ${roundIndex + 1} must be an array of matches`],
            sanitizedRound: []
        };
    }

    for (let i = 0; i < round.length; i++) {
        const match = round[i];

        // Handle bye matches
        if (match.bye !== undefined) {
            if (typeof match.bye !== 'string' || match.bye.trim() === '') {
                errors.push(`Round ${roundIndex + 1}, match ${i + 1}: bye team name is required`);
            } else {
                sanitizedRound.push({ bye: match.bye.trim() });
            }
            continue;
        }

        // Validate regular matches
        if (match.home === undefined || match.away === undefined) {
            errors.push(
                `Round ${roundIndex + 1}, match ${i + 1}: home and away teams are required`
            );
            continue;
        }

        if (typeof match.home !== 'string' || typeof match.away !== 'string') {
            errors.push(`Round ${roundIndex + 1}, match ${i + 1}: team names must be strings`);
            continue;
        }

        if (match.home.trim() === '' || match.away.trim() === '') {
            errors.push(`Round ${roundIndex + 1}, match ${i + 1}: team names cannot be empty`);
            continue;
        }

        if (match.home === match.away) {
            errors.push(`Round ${roundIndex + 1}, match ${i + 1}: team cannot play against itself`);
            continue;
        }

        // Validate scores
        const scoreResult = validateMatchScores(match);
        if (!scoreResult.isValid) {
            errors.push(
                ...scoreResult.errors.map(
                    (err) => `Round ${roundIndex + 1}, match ${i + 1}: ${err}`
                )
            );
        }

        sanitizedRound.push({
            home: match.home.trim(),
            away: match.away.trim(),
            homeScore: scoreResult.sanitizedMatch?.homeScore ?? match.homeScore,
            awayScore: scoreResult.sanitizedMatch?.awayScore ?? match.awayScore
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitizedRound
    };
}

/**
 * Validates complete schedule data structure
 * @param {Object} scheduleData - Schedule data with rounds and anchorIndex
 * @returns {{isValid: boolean, errors: string[], sanitizedData: Object}}
 */
export function validateScheduleData(scheduleData) {
    const errors = [];
    let sanitizedData = {
        rounds: [],
        anchorIndex: 0
    };

    if (!scheduleData || typeof scheduleData !== 'object') {
        return {
            isValid: false,
            errors: ['Schedule data must be a valid object'],
            sanitizedData: null
        };
    }

    // Validate anchorIndex
    if (scheduleData.anchorIndex !== undefined) {
        if (
            typeof scheduleData.anchorIndex !== 'number' ||
            !Number.isInteger(scheduleData.anchorIndex) ||
            scheduleData.anchorIndex < 0
        ) {
            errors.push('Anchor index must be a non-negative integer');
        } else {
            sanitizedData.anchorIndex = scheduleData.anchorIndex;
        }
    }

    // Validate rounds
    if (!scheduleData.rounds) {
        errors.push('Rounds array is required');
        return {
            isValid: false,
            errors,
            sanitizedData: null
        };
    }

    if (!Array.isArray(scheduleData.rounds)) {
        errors.push('Rounds must be an array');
        return {
            isValid: false,
            errors,
            sanitizedData: null
        };
    }

    // Validate each round
    for (let i = 0; i < scheduleData.rounds.length; i++) {
        const roundResult = validateRound(scheduleData.rounds[i], i);
        if (!roundResult.isValid) {
            errors.push(...roundResult.errors);
        }
        sanitizedData.rounds.push(roundResult.sanitizedRound);
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitizedData
    };
}

/**
 * Validates a games API request body
 * @param {Object} requestBody - Request body from games API
 * @returns {{isValid: boolean, errors: string[], sanitizedData: Object}}
 */
export function validateGameRequest(requestBody) {
    if (!requestBody || typeof requestBody !== 'object') {
        return {
            isValid: false,
            errors: ['Request body must be a valid JSON object'],
            sanitizedData: null
        };
    }

    // Use existing schedule validation
    const scheduleResult = validateScheduleData(requestBody);

    return {
        isValid: scheduleResult.isValid,
        errors: scheduleResult.errors,
        sanitizedData: scheduleResult.sanitizedData
    };
}

/**
 * Reserved keys for scorer tracking
 * These keys have special meanings and cannot be used as player names in scorer objects
 */
export const RESERVED_SCORER_KEYS = {
    OWN_GOAL: '__ownGoal__',
    UNASSIGNED: '__unassigned__'
};

/**
 * Configuration for scorer validation
 */
const SCORER_CONFIG = {
    maxOwnGoals: 2, // Maximum own goals per team in a single game (prevents data entry errors)
    allowPartial: true // Allow partial goal assignment (not all goals assigned to specific players)
};

/**
 * Validates scorer data for a game
 * @param {Object|null|undefined} scorers - Scorers object mapping player names to goal counts
 * @param {number|null} score - Total score for the team
 * @param {Array<string>} teamPlayers - Array of player names on this team
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateScorers(scorers, score, teamPlayers) {
    const errors = [];

    // Scorers is optional - null/undefined is valid
    if (scorers === null || scorers === undefined) {
        return { isValid: true, errors: [] };
    }

    // Must be an object
    if (typeof scorers !== 'object' || Array.isArray(scorers)) {
        return {
            isValid: false,
            errors: ['Scorers must be an object mapping player names to goal counts']
        };
    }

    // If score is null/undefined, scorers should also be null
    if (score === null || score === undefined) {
        if (Object.keys(scorers).length > 0) {
            return {
                isValid: false,
                errors: ['Cannot assign scorers when score is not set']
            };
        }
        return { isValid: true, errors: [] };
    }

    // Calculate total assigned goals
    let totalAssigned = 0;
    for (const [player, goals] of Object.entries(scorers)) {
        // Validate goal count is a positive integer
        if (!Number.isInteger(goals)) {
            errors.push(`Invalid goal count for ${player}: must be an integer`);
            continue;
        }

        if (goals < 0) {
            errors.push(`Invalid goal count for ${player}: cannot be negative`);
            continue;
        }

        if (goals === 0) {
            errors.push(
                `Invalid goal count for ${player}: use 0 goals by not including the player`
            );
            continue;
        }

        totalAssigned += goals;

        // Skip reserved keys for player validation
        if (player === RESERVED_SCORER_KEYS.OWN_GOAL) {
            // Validate own goal count is reasonable
            if (goals > SCORER_CONFIG.maxOwnGoals) {
                errors.push(
                    `Own goal count seems unusually high (${goals}). Maximum allowed: ${SCORER_CONFIG.maxOwnGoals}`
                );
            }
            continue;
        }

        if (player === RESERVED_SCORER_KEYS.UNASSIGNED) {
            // Future reserved key - valid
            continue;
        }

        // Validate player belongs to the team
        if (!teamPlayers || !Array.isArray(teamPlayers)) {
            errors.push('Team players array is required for validation');
            break;
        }

        if (!teamPlayers.includes(player)) {
            errors.push(`${player} is not on this team`);
        }
    }

    // Validate total assigned goals
    if (totalAssigned > score) {
        errors.push(`Total assigned goals (${totalAssigned}) exceeds team score (${score})`);
    }

    // If partial assignment is disabled, require all goals to be assigned
    if (!SCORER_CONFIG.allowPartial && totalAssigned < score) {
        errors.push(`All goals must be assigned. Assigned: ${totalAssigned}, Total: ${score}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates scorers for both home and away teams in a match
 * @param {Object} match - Match object with teams, scores, and optional scorers
 * @param {Object} teams - Teams object mapping team names to player arrays
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateMatchScorers(match, teams) {
    const errors = [];

    if (!match || typeof match !== 'object') {
        return {
            isValid: false,
            errors: ['Match must be a valid object']
        };
    }

    // Skip bye matches
    if (match.bye) {
        return { isValid: true, errors: [] };
    }

    // Validate home scorers
    if (match.homeScorers !== undefined && match.homeScorers !== null) {
        const homeTeamPlayers = teams?.[match.home] || [];
        const homeResult = validateScorers(match.homeScorers, match.homeScore, homeTeamPlayers);

        if (!homeResult.isValid) {
            errors.push(...homeResult.errors.map((err) => `Home team (${match.home}): ${err}`));
        }
    }

    // Validate away scorers
    if (match.awayScorers !== undefined && match.awayScorers !== null) {
        const awayTeamPlayers = teams?.[match.away] || [];
        const awayResult = validateScorers(match.awayScorers, match.awayScore, awayTeamPlayers);

        if (!awayResult.isValid) {
            errors.push(...awayResult.errors.map((err) => `Away team (${match.away}): ${err}`));
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate if competition modification operations are allowed based on timing
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {Object} settings - Settings object with registration window configuration
 * @returns {{isValid: boolean, error?: string}}
 */
export function validateCompetitionOperationsAllowed(dateString, settings) {
    if (!dateString || !settings) {
        return {
            isValid: false,
            error: 'Missing date or settings for validation'
        };
    }

    if (isCompetitionEnded(dateString, settings)) {
        return {
            isValid: false,
            error: 'Competition has ended. No modifications allowed.'
        };
    }

    return { isValid: true };
}
