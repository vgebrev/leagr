import { randomUUID } from 'node:crypto';
import { getLeagueInfo } from '$lib/server/league.js';
import { initializeEmailService } from '$lib/server/email.js';
import { logger, initializeLogger } from '$lib/server/logger.js';
import {
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    createSessionToken,
    isValidSessionToken
} from '$lib/server/session.js';

const rateLimitMap = new Map();
// Rule-based rate limiting configuration (first match wins)
const RATE_RULES = [
    {
        verb: 'POST',
        routePattern: /^\/api\/players(?:\/|$)/,
        maxRequests: 100,
        duration: 60 * 60 * 1000, // 1 hour
        message:
            "You've already added a player recently. Please use the share link to invite other players.",
        keyExtractor: (url) => url.searchParams.get('date') || 'no-date' // Include date in rate limit key
        // Uses ip+clientId key so different people on the same network get separate quotas
    },
    {
        verb: '*',
        routePattern: /^\/api\//,
        maxRequests: 60,
        duration: 60 * 1000, // 1 minute
        message: 'Too many requests.',
        ipOnly: true // Keyed on IP alone so UUID rotation cannot bypass this limit
    }
];

const allowedOrigin = process.env.ALLOWED_ORIGIN || import.meta.env.VITE_ALLOWED_ORIGIN;
// SESSION_SECRET signs HttpOnly session cookies issued to first-party clients.
const SESSION_SECRET = process.env.SESSION_SECRET || import.meta.env.VITE_SESSION_SECRET;
const APP_URL = process.env.APP_URL || import.meta.env.VITE_APP_URL;
const IS_HTTPS = APP_URL?.startsWith('https://') ?? true;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || import.meta.env.VITE_MAILGUN_SENDING_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || import.meta.env.VITE_MAILGUN_DOMAIN;
const LOG_LEVEL = process.env.LOG_LEVEL || import.meta.env.VITE_LOG_LEVEL;

// Initialize services
initializeEmailService(MAILGUN_API_KEY, MAILGUN_DOMAIN, APP_URL);
initializeLogger(LOG_LEVEL);

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
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        event.getClientAddress?.() ||
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

function isRateLimitedFor(rule, key, extraKey = '') {
    const now = Date.now();
    const mapKey = `${rule.verb}:${rule.routePattern}:${key}${extraKey ? `:${extraKey}` : ''}`;
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

// Public endpoints that don't require league access code
const publicEndpoints = [
    { method: '*', pattern: /^\/api\/leagues/ },
    { method: 'GET', pattern: /^\/api\/rankings\/[^/]+\/avatar$/ },
    { method: 'GET', pattern: /^\/api\/teams\/logos\// }
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

// Credential-bearing fields that must never reach the log file. Access codes were
// previously written to app.log in plaintext by the DEBUG body logger below.
const REDACTED_KEYS = new Set([
    'accesscode',
    'admincode',
    'newaccesscode',
    'password',
    'resetcode',
    'secret',
    'token'
]);

/**
 * Recursively replace credential values with a placeholder.
 * @param {unknown} value
 * @returns {unknown}
 */
function redactSecrets(value) {
    if (Array.isArray(value)) {
        return value.map(redactSecrets);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, val]) => [
                key,
                REDACTED_KEYS.has(key.toLowerCase()) ? '[redacted]' : redactSecrets(val)
            ])
        );
    }
    return value;
}

/**
 * Render a raw JSON request body for logging with credentials stripped.
 * @param {string} rawBody
 * @returns {string}
 */
export function sanitizeBodyForLog(rawBody) {
    try {
        return JSON.stringify(redactSecrets(JSON.parse(rawBody)));
    } catch {
        // Never log a body we could not parse — it may hold credentials in an unknown shape.
        return '[unparseable body omitted]';
    }
}

function logApiRequest(method, url, leagueId, ip, status, durationMs, body = null) {
    const path = url.pathname + (url.search ? url.search : '');
    // Tag failures so a status line is greppable alongside its [ERROR] entry.
    const marker = status >= 500 ? ' FAILED' : status >= 400 ? ' REJECTED' : '';
    logger.info(
        `${method} ${path} ${status}${marker} ${durationMs}ms league=${leagueId ?? 'none'} ip=${ip}`
    );
    if (body) {
        logger.debug(`${method} ${path} body:`, sanitizeBodyForLog(body));
    }
}

export const handle = async ({ event, resolve }) => {
    const start = Date.now();
    const ip = getIp(event);
    const { url, request } = event;

    if (request.method === 'OPTIONS') {
        const { allowed, origin } = isOriginAllowed(request);
        if (url.pathname.startsWith('/api/')) {
            logApiRequest(request.method, url, null, ip, 204, Date.now() - start);
        }
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
                'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
                'Access-Control-Allow-Headers':
                    'Content-Type,X-CLIENT-ID,X-ADMIN-CODE,X-ADMIN-UNLOCK,Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    // Issue a signed HttpOnly session cookie on page loads so the API can verify it.
    // Cookies are scoped to the current host (per-league subdomain) automatically.
    if (!url.pathname.startsWith('/api/')) {
        const existing = event.cookies.get(SESSION_COOKIE);
        if (SESSION_SECRET && !isValidSessionToken(existing, SESSION_SECRET)) {
            event.cookies.set(SESSION_COOKIE, createSessionToken(SESSION_SECRET), {
                httpOnly: true,
                secure: IS_HTTPS,
                sameSite: 'strict',
                path: '/',
                maxAge: SESSION_MAX_AGE
            });
        }
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
            logApiRequest(request.method, url, leagueId, ip, 401, Date.now() - start);
            return new Response(JSON.stringify({ message: 'Origin not allowed' }), { status: 401 });
        }

        if (!isPublic && !isValidSessionToken(event.cookies.get(SESSION_COOKIE), SESSION_SECRET)) {
            logApiRequest(request.method, url, leagueId, ip, 401, Date.now() - start);
            return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
        }

        // Require client identification for all API endpoints (except public)
        const clientId = request.headers.get('x-client-id');
        if (!isPublic && !clientId) {
            logApiRequest(request.method, url, leagueId, ip, 400, Date.now() - start);
            return new Response(JSON.stringify({ message: 'Unidentified Client' }), {
                status: 400
            });
        }

        // Apply rule-based rate-limiting (first matching rule)
        const rule = pickRateRule(request.method, url.pathname);
        if (rule) {
            const rateLimitKey = rule.ipOnly ? ip : `${ip}|${clientId || 'public'}`;
            const extraKey = rule.keyExtractor ? rule.keyExtractor(url) : '';
            if (isRateLimitedFor(rule, rateLimitKey, extraKey)) {
                logApiRequest(request.method, url, leagueId, ip, 429, Date.now() - start);
                return new Response(JSON.stringify({ message: rule.message }), { status: 429 });
            }
        }

        // Check access code for API requests (except public endpoints)
        if (!isPublic) {
            const accessCode = request.headers.get('authorization');

            // Must have league info and access code for protected endpoints
            if (!event.locals.leagueInfo) {
                logApiRequest(request.method, url, leagueId, ip, 400, Date.now() - start);
                return new Response(JSON.stringify({ message: 'League info missing.' }), {
                    status: 400
                });
            }

            if (!accessCode) {
                logApiRequest(request.method, url, leagueId, ip, 403, Date.now() - start);
                return new Response(JSON.stringify({ message: 'League access code required.' }), {
                    status: 403
                });
            }

            if (accessCode !== event.locals.leagueInfo.accessCode) {
                logApiRequest(request.method, url, leagueId, ip, 403, Date.now() - start);
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

        // Admin "unlock session" intent for post-session fixes. The header carries the date the
        // admin explicitly unlocked, so a stale unlock can never affect a different session.
        const suppliedUnlockDate = request.headers.get('x-admin-unlock');
        event.locals.adminUnlockDate =
            event.locals.isAdmin &&
            suppliedUnlockDate &&
            /^\d{4}-\d{2}-\d{2}$/.test(suppliedUnlockDate)
                ? suppliedUnlockDate
                : null;

        event.locals.clientId = clientId;
    }

    let requestBody = null;
    if (
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method) &&
        url.pathname.startsWith('/api/') &&
        (request.headers.get('content-type') || '').includes('application/json')
    ) {
        try {
            requestBody = await request.clone().text();
        } catch {
            // ignore — body read failure should never affect the request
        }
    }

    let response;
    try {
        response = await resolve(event);
    } catch (err) {
        // resolve() throwing means the request never produced a Response. Record the
        // attempt here, then re-throw so handleError logs the cause with its stack.
        if (url.pathname.startsWith('/api/')) {
            logApiRequest(request.method, url, leagueId, ip, 500, Date.now() - start, requestBody);
        }
        throw err;
    }

    if (url.pathname.startsWith('/api/')) {
        logApiRequest(
            request.method,
            url,
            leagueId,
            ip,
            response.status,
            Date.now() - start,
            requestBody
        );
    }

    response.headers.set('Access-Control-Allow-Origin', allowed ? origin || '*' : 'null');
    return response;
};

/**
 * Catch-all handler for unexpected server errors.
 *
 * SvelteKit calls this only for genuine failures — errors raised with `error()` are
 * an intended response and bypass it. This is the single place a stack reaches the
 * log file; routes no longer need their own console.error.
 *
 * @type {import('@sveltejs/kit').HandleServerError}
 */
export const handleError = ({ error: err, event, status, message }) => {
    const errorId = randomUUID();
    const path = event.url.pathname + (event.url.search ? event.url.search : '');
    const cause = /** @type {any} */ (err);

    logger.error(
        `Unhandled ${status} ${event.request.method} ${path} errorId=${errorId}`,
        {
            errorId,
            league: event.locals?.leagueId ?? 'none',
            clientId: event.locals?.clientId ?? null,
            name: cause?.name,
            message: cause?.message,
            ...(cause?.apiContext ?? {})
        },
        err instanceof Error ? err : String(err)
    );

    // apiFallbackMessage is attached by toApiError so the client still gets a
    // route-specific message instead of SvelteKit's bare "Internal Error".
    return {
        message: cause?.apiFallbackMessage || message,
        errorId
    };
};
