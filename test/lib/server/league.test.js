import { describe, it, expect } from 'vitest';
import { extractLeagueId } from '$lib/server/league.js';

const APP_URL = 'https://leagr.co.za';

/**
 * extractLeagueId turns the request host into a league id, which
 * getLeagueDataPath then joins straight into a filesystem path. The host
 * reaches the app via X-Forwarded-Host, so without validation a host of
 * "../../x.leagr.co.za" escapes the data directory. isValidSubdomain is the
 * same guard league creation already applies; these tests pin it to the read
 * path too.
 */
describe('extractLeagueId', () => {
    it('returns the subdomain for a league host', () => {
        expect(extractLeagueId('pirates.leagr.co.za', APP_URL)).toBe('pirates');
    });

    it('ignores a port on the host', () => {
        expect(extractLeagueId('pirates.leagr.co.za:3001', APP_URL)).toBe('pirates');
    });

    it('returns null for the root domain and for localhost', () => {
        expect(extractLeagueId('leagr.co.za', APP_URL)).toBeNull();
        expect(extractLeagueId('localhost', APP_URL)).toBeNull();
    });

    it('returns null when the host is missing or the app url is unset', () => {
        expect(extractLeagueId(null, APP_URL)).toBeNull();
        expect(extractLeagueId('pirates.leagr.co.za', undefined)).toBeNull();
    });

    it('returns null for a host belonging to another domain', () => {
        expect(extractLeagueId('pirates.example.com', APP_URL)).toBeNull();
    });

    describe('path traversal', () => {
        it.each([
            ['../../x.leagr.co.za'],
            ['../x.leagr.co.za'],
            ['a/b.leagr.co.za'],
            ['..%2Fx.leagr.co.za'],
            ['.leagr.co.za']
        ])('rejects %s', (host) => {
            expect(extractLeagueId(host, APP_URL)).toBeNull();
        });
    });

    it('rejects a reserved subdomain', () => {
        expect(extractLeagueId('api.leagr.co.za', APP_URL)).toBeNull();
        expect(extractLeagueId('www.leagr.co.za', APP_URL)).toBeNull();
    });

    it('rejects a subdomain below the length floor', () => {
        expect(extractLeagueId('ab.leagr.co.za', APP_URL)).toBeNull();
    });

    it('rejects a subdomain that starts or ends with a hyphen', () => {
        expect(extractLeagueId('-pirates.leagr.co.za', APP_URL)).toBeNull();
        expect(extractLeagueId('pirates-.leagr.co.za', APP_URL)).toBeNull();
    });
});
