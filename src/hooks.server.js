const rateLimitMap = new Map();
const RATE_LIMIT_DURATION = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

const allowedOrigin = process.env.ALLOWED_ORIGIN || import.meta.env.VITE_ALLOWED_ORIGIN;
const API_KEY = process.env.API_KEY || import.meta.env.VITE_API_KEY;

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
    if (!allowedOrigin) return true;
    const origin = request.headers.get('origin');
    const referrer = request.headers.get('referer');
    return allowedOrigin.split(',').some((ao) => {
        const trimmedAo = ao.trim();

        if (trimmedAo.includes('*')) {
            const pattern = trimmedAo.replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            return (origin && regex.test(origin)) || (referrer && regex.test(referrer));
        }

        // Original exact match logic
        return origin === trimmedAo || referrer?.startsWith(trimmedAo);
    });
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
        return new Response('Too many requests', { status: 429 });
    }
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,X-API-KEY',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    if (url.pathname.startsWith('/api/')) {
        if (!isOriginAllowed(request)) {
            return new Response('Forbidden', { status: 403 });
        }

        if (!checkApiKey(request)) {
            return new Response('Unauthorized', { status: 401 });
        }
    }
    const response = await resolve(event);
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    return response;
};
