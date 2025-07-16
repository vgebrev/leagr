/**
 * League authentication service for managing access codes
 */
import { api } from './api-client.svelte.js';

/**
 * Get the stored access code for a league from localStorage
 * @param {string} leagueId - The league identifier
 * @returns {string|null} The stored access code or null if not found
 */
export function getStoredAccessCode(leagueId) {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(`${leagueId}/accessCode`);
        return stored;
    } catch (error) {
        console.error('Error reading access code from localStorage:', error);
        return null;
    }
}

/**
 * Store an access code for a league in localStorage
 * @param {string} leagueId - The league identifier
 * @param {string} accessCode - The access code to store
 */
export function storeAccessCode(leagueId, accessCode) {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(`${leagueId}/accessCode`, accessCode);
    } catch (error) {
        console.error('Error storing access code in localStorage:', error);
    }
}

/**
 * Remove the stored access code for a league
 * @param {string} leagueId - The league identifier
 */
export function removeStoredAccessCode(leagueId) {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(`${leagueId}/accessCode`);
    } catch (error) {
        console.error('Error removing access code from localStorage:', error);
    }
}

/**
 * Validate an access code with the server
 * @param {string} accessCode - The access code to validate
 * @returns {Promise<boolean>} True if valid, false otherwise
 */
export async function validateAccessCode(accessCode) {
    try {
        const response = await api.postDirect('leagues/authenticate', { accessCode });
        return response.success === true;
    } catch (error) {
        console.error('Access code validation error:', error);
        return false;
    }
}

/**
 * Check if a user is authenticated for a league by checking localStorage
 * @param {string} leagueId - The league identifier
 * @returns {boolean} True if authenticated (has stored code), false otherwise
 */
export function isAuthenticated(leagueId) {
    if (!leagueId) {
        return false;
    }

    return !!getStoredAccessCode(leagueId);
}

/**
 * Extract access code from URL query parameters
 * @param {URLSearchParams} searchParams - URL search parameters
 * @returns {string|null} The access code from query params or null
 */
export function extractAccessCodeFromQuery(searchParams) {
    return searchParams.get('code');
}
