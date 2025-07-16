import { getStoredAccessCode, removeStoredAccessCode } from './auth.js';
import { goto } from '$app/navigation';

const baseUrl = '/api';
let apiKey = $state('');
let leagueId = $state('');

export function setApiKey(key) {
    apiKey = key;
}

export function setLeagueId(id) {
    leagueId = id;
}

function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
    };

    // Add access code to Authorization header if we have a league context
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
        goto(`/auth?redirect=${redirectUrl}`);
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
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        throw new Error(`HTTP error! status: ${response.status}`);
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
        throw new Error(`HTTP error! status: ${response.status}`);
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
