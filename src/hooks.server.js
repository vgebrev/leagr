import { getLeagueInfo } from '$lib/server/league.js';
import { initializeEmailService } from '$lib/server/email.js';

const rateLimitMap = new Map();
// Rule-based rate limiting configuration (first match wins)
const RATE_RULES = [
    {
        verb: 'POST',
        routePattern: /^\/api\/players(?:\/|$)/,
        maxRequests: 1000,
        duration: 60 * 60 * 1000, // 1 hour
        message:
            "You've already added a player recently. Please use the share link to invite other players."
    },
    {
        verb: '*',
        routePattern: /^\/api\//,
        maxRequests: 60,
        duration: 60 * 1000, // 1 minute
        message: 'Too many requests.'
    }
];

const allowedOrigin = process.env.ALLOWED_ORIGIN || import.meta.env.VITE_ALLOWED_ORIGIN;
const API_KEY = process.env.API_KEY || import.meta.env.VITE_API_KEY;
const APP_URL = process.env.APP_URL || import.meta.env.VITE_APP_URL;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || import.meta.env.VITE_MAILGUN_SENDING_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || import.meta.env.VITE_MAILGUN_DOMAIN;

// Initialize email service
initializeEmailService(MAILGUN_API_KEY, MAILGUN_DOMAIN, APP_URL);

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

    // If it's not a recognised domain format, return null
    return null;
}

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
const getIp = (event) => {
    const { request } = event;
    return (
        event.getClientAddress?.() ||
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
};

function pickRateRule(method, path) {
    const m = method.toUpperCase();
    for (const rule of RATE_RULES) {
        if ((rule.verb === '*' || rule.verb.toUpperCase() === m) && rule.routePattern.test(path)) {
            return rule;
        }
    }
    return null;
}

function isRateLimitedFor(rule, key) {
    const now = Date.now();
    const mapKey = `${rule.verb}:${rule.routePattern}:${key}`;
    const data = rateLimitMap.get(mapKey) || { count: 0, firstRequestTime: now };

    if (now - data.firstRequestTime > rule.duration) {
        data.count = 1;
        data.firstRequestTime = now;
    } else {
        data.count += 1;
    }

    rateLimitMap.set(mapKey, data);
    return data.count > rule.maxRequests;
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

// Public endpoints that don't require league access code
const publicEndpoints = [
    { method: '*', pattern: /^\/api\/leagues/ },
    { method: 'GET', pattern: /^\/api\/rankings\/[^/]+\/avatar$/ }
];

/**
 * Check if the request is for a public endpoint
 * @param {string} method - HTTP method
 * @param {string} pathname - Request pathname
 * @returns {boolean}
 */
function isPublicEndpoint(method, pathname) {
    return publicEndpoints.some(
        (endpoint) =>
            (endpoint.method === '*' || endpoint.method === method) &&
            endpoint.pattern.test(pathname)
    );
}

export const handle = async ({ event, resolve }) => {
    const ip = getIp(event);
    const { url, request } = event;

    if (request.method === 'OPTIONS') {
        const { allowed, origin } = isOriginAllowed(request);
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
                'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
                'Access-Control-Allow-Headers':
                    'Content-Type,X-API-KEY,X-CLIENT-ID,X-ADMIN-CODE,Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    // Extract league ID from host and load league info
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const leagueId = extractLeagueId(host);
    // Add league info to event locals for use in routes
    event.locals.leagueId = leagueId;
    event.locals.leagueInfo = getLeagueInfo(leagueId);

    const { allowed, origin } = isOriginAllowed(request);

    if (url.pathname.startsWith('/api/')) {
        const isPublic = isPublicEndpoint(request.method, url.pathname);

        if (!allowed) {
            // Use 401 so the client does not treat this as a league auth failure (403 triggers logout)
            return new Response(JSON.stringify({ message: 'Origin not allowed' }), { status: 401 });
        }

        if (!isPublic && !checkApiKey(request)) {
            return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
        }

        // Require client identification for all API endpoints (except public)
        const clientId = request.headers.get('x-client-id');
        if (!isPublic && !clientId) {
            return new Response(JSON.stringify({ message: 'Unidentified Client' }), {
                status: 400
            });
        }

        // Apply rule-based rate-limiting (first matching rule)
        const rule = pickRateRule(request.method, url.pathname);
        if (rule) {
            const composite = `${ip}|${clientId || 'public'}`;
            if (isRateLimitedFor(rule, composite)) {
                return new Response(JSON.stringify({ message: rule.message }), { status: 429 });
            }
        }

        // Check access code for API requests (except public endpoints)
        if (!isPublic) {
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

        // Admin claim via header (optional): when provided and matches, elevate privileges
        // If adminCode not configured, fallback to accessCode as admin for backward-compat
        const suppliedAdminCode = request.headers.get('x-admin-code');
        const expectedAdminCode = event.locals.leagueInfo?.adminCode; // strict: do not fallback to accessCode
        event.locals.isAdmin = Boolean(
            suppliedAdminCode && expectedAdminCode && suppliedAdminCode === expectedAdminCode
        );
        event.locals.clientId = clientId;
    }

    const response = await resolve(event);
    response.headers.set('Access-Control-Allow-Origin', allowed ? origin || '*' : 'null');
    return response;
};
