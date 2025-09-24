import { getStoredAccessCode, removeStoredAccessCode } from './auth.js';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

class HttpError extends Error {
    constructor(message, status, body) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.body = body;
    }
}

const baseUrl = '/api';
let apiKey = $state('');
let leagueId = $state('');
let clientId = $state('');
let adminCode = $state('');

export function setApiKey(key) {
    apiKey = key;
}

export function setLeagueId(id) {
    leagueId = id;
}

export function getLeagueId() {
    return leagueId;
}

export function setAdminCode(code) {
    adminCode = code || '';
}

export function clearAdminCode() {
    adminCode = '';
}

export function setClientId(id) {
    clientId = id;
}

// Ensure a stable client ID exists in browser localStorage and is set in memory
function ensureClientIdInitialized() {
    if (clientId) return;
    if (typeof window === 'undefined') return;
    try {
        const key = 'leagr_client_id';
        let id = window.localStorage.getItem(key);
        if (!id) {
            const rnd =
                typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
            id = `lcid_${rnd}`;
            window.localStorage.setItem(key, id);
        }
        clientId = id;
    } catch {
        // If storage fails, we simply won't send the client-id; server will reject accordingly
    }
}

// Attempt initialization at module import time (browser only)
if (typeof window !== 'undefined') {
    ensureClientIdInitialized();
}

function getAuthHeaders() {
    // Be defensive: ensure client ID is initialized before building headers
    ensureClientIdInitialized();

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
    };

    if (clientId) {
        headers['x-client-id'] = clientId;
    }

    if (adminCode) {
        headers['x-admin-code'] = adminCode;
    }

    // Add access code to the "Authorization" header if we have a league context
    if (leagueId) {
        const accessCode = getStoredAccessCode(leagueId);
        if (accessCode) {
            headers['Authorization'] = accessCode;
        }
    }

    return headers;
}

function handleAuthError(response) {
    if (response.status === 403) {
        // Clear stored access code and redirect to auth
        if (leagueId) {
            removeStoredAccessCode(leagueId);
        }

        // Get current URL for redirect
        const currentUrl =
            typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
        const redirectUrl = encodeURIComponent(currentUrl);
        goto(resolve(`/auth?redirect=${redirectUrl}`));
    }
}

async function get(key, date) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const headers = getAuthHeaders();
    delete headers['Content-Type']; // GET requests don't need Content-Type
    const response = await fetch(url, { headers });
    if (!response.ok) {
        handleAuthError(response);
        const errorData = await response
            .json()
            .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new HttpError(
            errorData.message || `HTTP error! status: ${response.status}`,
            response.status,
            errorData
        );
    }
    return await response.json();
}

async function post(key, date, value) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        handleAuthError(response);
        const errorData = await response
            .json()
            .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new HttpError(
            errorData.message || `HTTP error! status: ${response.status}`,
            response.status,
            errorData
        );
    }

    return await response.json();
}

async function postDirect(endpoint, value) {
    const url = `${baseUrl}/${endpoint}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        handleAuthError(response);
        const errorData = await response
            .json()
            .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new HttpError(
            errorData.message || `HTTP error! status: ${response.status}`,
            response.status,
            errorData
        );
    }

    return await response.json();
}

async function remove(key, date, value) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        handleAuthError(response);
        const errorData = await response
            .json()
            .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new HttpError(
            errorData.message || `HTTP error! status: ${response.status}`,
            response.status,
            errorData
        );
    }
    return await response.json();
}

async function patch(key, date, value) {
    const url = `${baseUrl}/${key}${date ? `?date=${date}` : ''}`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(value)
    });
    if (!response.ok) {
        handleAuthError(response);
        const errorData = await response
            .json()
            .catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new HttpError(
            errorData.message || `HTTP error! status: ${response.status}`,
            response.status,
            errorData
        );
    }
    return await response.json();
}

export const api = {
    get,
    post,
    postDirect,
    remove,
    patch
};
