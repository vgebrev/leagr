import { getLeagueInfo } from '$lib/server/league.js';

const rateLimitMap = new Map();
const RATE_LIMIT_DURATION = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

const allowedOrigin = process.env.ALLOWED_ORIGIN || import.meta.env.VITE_ALLOWED_ORIGIN;
const API_KEY = process.env.API_KEY || import.meta.env.VITE_API_KEY;
const APP_URL = process.env.APP_URL || import.meta.env.VITE_APP_URL;

/**
 * Extract league identifier from subdomain
 * @param {string} host - The host header (e.g., "pirates.leagr.local:5173")
 * @returns {string|null} - The league name or null if no subdomain
 */
function extractLeagueId(host) {
    if (!host || !APP_URL) return null;

    // Remove port if present
    const hostname = host.split(':')[0];

    // Extract the base domain from APP_URL
    const appUrl = new URL(APP_URL);
    const baseDomain = appUrl.hostname;

    // Check for root domain (no league)
    if (hostname === baseDomain || hostname === 'localhost') {
        return null;
    }

    // Split by dots and check if it's a subdomain
    const parts = hostname.split('.');

    // Check if it's a subdomain of our base domain
    if (parts.length >= 2) {
        const domain = parts.slice(1).join('.');
        if (domain === baseDomain) {
            return parts[0]; // Return the subdomain as league ID
        }
    }

    // If it's not a recognized domain format, return null
    return null;
}

const getIp = (event) => {
    const { request } = event;
    return (
        event.getClientAddress?.() ||
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
};

function checkRateLimit(ip) {
    const currentTime = Date.now();
    const requestData = rateLimitMap.get(ip) || { count: 0, firstRequestTime: currentTime };

    if (currentTime - requestData.firstRequestTime > RATE_LIMIT_DURATION) {
        requestData.count = 1;
        requestData.firstRequestTime = currentTime;
    } else {
        requestData.count += 1;
    }

    rateLimitMap.set(ip, requestData);

    return requestData.count > RATE_LIMIT_MAX_REQUESTS;
}

function isOriginAllowed(request) {
    if (!allowedOrigin) return { allowed: true, origin: null };
    const origin = request.headers.get('origin');
    const referrer = request.headers.get('referer');
    const referrerBase = referrer ? new URL(referrer).origin : null;

    for (const ao of allowedOrigin.split(',')) {
        const trimmedAo = ao.trim();

        if (trimmedAo.includes('*')) {
            const pattern = trimmedAo.replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            if (origin && regex.test(origin)) {
                return { allowed: true, origin };
            }
            if (referrerBase && regex.test(referrerBase)) {
                return { allowed: true, origin: referrerBase };
            }
        } else {
            // Original exact match logic
            if (origin === trimmedAo) {
                return { allowed: true, origin };
            }
            if (referrerBase === trimmedAo) {
                return { allowed: true, origin: referrerBase };
            }
        }
    }

    return { allowed: false, origin: null };
}

function checkApiKey(request) {
    if (!API_KEY) return true;
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization');
    return apiKey && apiKey === API_KEY;
}

export const handle = async ({ event, resolve }) => {
    const ip = getIp(event);
    const { url, request } = event;

    if (checkRateLimit(ip)) {
        return new Response(JSON.stringify({ message: 'Too many requests.' }), { status: 429 });
    }

    if (request.method === 'OPTIONS') {
        const { allowed, origin } = isOriginAllowed(request);
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
                'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,X-API-KEY',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    // Extract league ID from host and load league info
    const host = request.headers.get('host');
    const leagueId = extractLeagueId(host);
    // Add league info to event locals for use in routes
    event.locals.leagueId = leagueId;
    event.locals.leagueInfo = getLeagueInfo(leagueId);

    const { allowed, origin } = isOriginAllowed(request);

    if (url.pathname.startsWith('/api/')) {
        if (!allowed) {
            return new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
        }

        if (!checkApiKey(request)) {
            return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
        }

        // Check access code for API requests (except public league endpoints)
        if (!url.pathname.startsWith('/api/leagues/')) {
            const accessCode = request.headers.get('authorization');

            // Must have league info and access code for protected endpoints
            if (!event.locals.leagueInfo) {
                return new Response(JSON.stringify({ message: 'League info missing.' }), {
                    status: 400
                });
            }

            if (!accessCode) {
                return new Response(JSON.stringify({ message: 'League access code required.' }), {
                    status: 403
                });
            }

            if (accessCode !== event.locals.leagueInfo.accessCode) {
                return new Response(JSON.stringify({ message: 'Invalid league access code.' }), {
                    status: 403
                });
            }
        }
    }

    const response = await resolve(event);
    response.headers.set('Access-Control-Allow-Origin', allowed ? origin || '*' : 'null');
    return response;
};
