import { describe, it, expect } from 'vitest';
import { stripPort } from '$lib/server/requestIp.js';

/**
 * IIS ARR appends the client's ephemeral source port to X-Forwarded-For
 * (e.g. "41.126.237.163:46339"). getIp fed that value straight into the
 * rate-limit key, so the key rotated on every new TCP connection and the
 * limits never actually engaged. stripPort normalises it back to the address.
 */
describe('stripPort', () => {
    it('strips the port ARR appends to an IPv4 address', () => {
        expect(stripPort('41.126.237.163:46339')).toBe('41.126.237.163');
    });

    it('collapses the same client seen on different source ports to one key', () => {
        const observed = ['41.126.237.163:46339', '41.126.237.163:13135', '41.126.237.163:16985'];
        expect(new Set(observed.map(stripPort)).size).toBe(1);
    });

    it('leaves a bare IPv4 address untouched', () => {
        expect(stripPort('41.126.237.163')).toBe('41.126.237.163');
    });

    it('strips the port from a bracketed IPv6 address', () => {
        expect(stripPort('[2001:db8::1]:443')).toBe('2001:db8::1');
    });

    it('unwraps a bracketed IPv6 address carrying no port', () => {
        expect(stripPort('[2001:db8::1]')).toBe('2001:db8::1');
    });

    it('does not truncate a bare IPv6 address at its first colon', () => {
        expect(stripPort('2001:db8::1')).toBe('2001:db8::1');
        expect(stripPort('::1')).toBe('::1');
    });

    it('trims surrounding whitespace from a forwarded entry', () => {
        expect(stripPort('  41.126.237.163:46339  ')).toBe('41.126.237.163');
    });

    it('passes through the unknown sentinel and empty input unchanged', () => {
        expect(stripPort('unknown')).toBe('unknown');
        expect(stripPort('')).toBe('');
    });
});
