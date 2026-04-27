import crypto from 'crypto';

export const SESSION_COOKIE = '_ls';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds

/**
 * Issue a signed session token.
 * Format: <16-byte-hex-id>.<hex-timestamp>.<sha256-hmac-hex>
 * All three segments are hex so they never contain a dot.
 * @param {string} secret
 * @returns {string}
 */
export function createSessionToken(secret) {
    const id = crypto.randomBytes(16).toString('hex');
    const iat = Date.now().toString(16);
    const payload = `${id}.${iat}`;
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}.${sig}`;
}

/**
 * Verify a session token.
 * Returns true when no secret is configured (open deployment).
 * @param {string | undefined} token
 * @param {string | undefined} secret
 * @returns {boolean}
 */
export function isValidSessionToken(token, secret) {
    if (!secret) return true;
    if (!token || typeof token !== 'string') return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [id, iatHex, sig] = parts;
    const payload = `${id}.${iatHex}`;

    // Timing-safe HMAC comparison
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    try {
        if (sig.length !== expectedSig.length) return false;
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex')))
            return false;
    } catch {
        return false;
    }

    // Expiry check (server-side, independent of cookie Max-Age)
    const iat = parseInt(iatHex, 16);
    if (isNaN(iat)) return false;
    return Date.now() - iat <= SESSION_MAX_AGE * 1000;
}
