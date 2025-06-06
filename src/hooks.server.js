import { rateLimit } from '$lib/server/rate-limit.js';

const getIp = (event) => {
    const { request } = event;
    return (
        event.getClientAddress?.() ||
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
};

export const handle = async ({ event, resolve }) => {
    const ip = getIp(event);
    if (rateLimit.isExceeded(ip)) {
        return new Response('Too many requests', { status: 429 });
    }
    return resolve(event);
};
