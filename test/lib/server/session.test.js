import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createSessionToken, isValidSessionToken, SESSION_MAX_AGE } from '$lib/server/session.js';

const SECRET = 'test-secret-key';

describe('createSessionToken', () => {
    it('returns a three-part dot-separated string', () => {
        const token = createSessionToken(SECRET);
        expect(token.split('.')).toHaveLength(3);
    });

    it('produces unique tokens on each call', () => {
        const a = createSessionToken(SECRET);
        const b = createSessionToken(SECRET);
        expect(a).not.toBe(b);
    });

    it('contains only hex characters and dots', () => {
        const token = createSessionToken(SECRET);
        expect(token).toMatch(/^[0-9a-f.]+$/);
    });
});

describe('isValidSessionToken', () => {
    it('accepts a freshly created token', () => {
        const token = createSessionToken(SECRET);
        expect(isValidSessionToken(token, SECRET)).toBe(true);
    });

    it('returns true when no secret is configured (open deployment)', () => {
        expect(isValidSessionToken(undefined, undefined)).toBe(true);
        expect(isValidSessionToken('anything', '')).toBe(true);
        expect(isValidSessionToken('anything', null)).toBe(true);
    });

    it('rejects undefined/null/empty token', () => {
        expect(isValidSessionToken(undefined, SECRET)).toBe(false);
        expect(isValidSessionToken(null, SECRET)).toBe(false);
        expect(isValidSessionToken('', SECRET)).toBe(false);
    });

    it('rejects a token with wrong structure', () => {
        expect(isValidSessionToken('foo', SECRET)).toBe(false);
        expect(isValidSessionToken('foo.bar', SECRET)).toBe(false);
        expect(isValidSessionToken('foo.bar.baz.qux', SECRET)).toBe(false);
    });

    it('rejects a token signed with a different secret', () => {
        const token = createSessionToken('other-secret');
        expect(isValidSessionToken(token, SECRET)).toBe(false);
    });

    it('rejects a tampered payload', () => {
        const token = createSessionToken(SECRET);
        const parts = token.split('.');
        // flip a character in the id segment
        parts[0] = parts[0].slice(0, -1) + (parts[0].slice(-1) === 'a' ? 'b' : 'a');
        expect(isValidSessionToken(parts.join('.'), SECRET)).toBe(false);
    });

    it('rejects a tampered signature', () => {
        const token = createSessionToken(SECRET);
        const parts = token.split('.');
        parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
        expect(isValidSessionToken(parts.join('.'), SECRET)).toBe(false);
    });

    it('rejects an expired token', () => {
        const id = 'a'.repeat(32);
        // iat 8 days ago in hex
        const iat = (Date.now() - (SESSION_MAX_AGE + 24 * 60 * 60) * 1000).toString(16);
        const payload = `${id}.${iat}`;
        const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
        expect(isValidSessionToken(`${payload}.${sig}`, SECRET)).toBe(false);
    });
});
