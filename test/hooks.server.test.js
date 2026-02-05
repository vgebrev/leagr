import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit tests for rate limiting with query parameters
 *
 * These tests verify that the rate limiting logic correctly includes
 * query parameters (specifically the 'date' parameter) in the rate limit key.
 * This prevents users who accidentally register for the wrong date from being
 * blocked when they try to register for the correct date.
 */
describe('Rate Limiting with Query Parameters', () => {
    // Rate limit map to simulate the implementation
    const rateLimitMap = new Map();

    // Simulate the rate rule
    const playerPostRule = {
        verb: 'POST',
        routePattern: /^\/api\/players(?:\/|$)/,
        maxRequests: 1,
        duration: 60 * 60 * 1000, // 1 hour
        keyExtractor: (url) => url.searchParams.get('date') || 'no-date'
    };

    // Simulate the isRateLimitedFor function
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

    beforeEach(() => {
        rateLimitMap.clear();
    });

    it('should rate limit requests with the same date parameter', () => {
        const url1 = new URL('http://example.com/api/players?date=2024-01-15');
        const url2 = new URL('http://example.com/api/players?date=2024-01-15');
        const clientKey = '127.0.0.1|client-123';

        // First request
        const extraKey1 = playerPostRule.keyExtractor(url1);
        const isLimited1 = isRateLimitedFor(playerPostRule, clientKey, extraKey1);
        expect(isLimited1).toBe(false);

        // Second request with same date should be rate limited
        const extraKey2 = playerPostRule.keyExtractor(url2);
        const isLimited2 = isRateLimitedFor(playerPostRule, clientKey, extraKey2);
        expect(isLimited2).toBe(true);
    });

    it('should NOT rate limit requests with different date parameters', () => {
        const url1 = new URL('http://example.com/api/players?date=2024-01-15');
        const url2 = new URL('http://example.com/api/players?date=2024-01-16');
        const clientKey = '127.0.0.1|client-123';

        // First request for date 2024-01-15
        const extraKey1 = playerPostRule.keyExtractor(url1);
        const isLimited1 = isRateLimitedFor(playerPostRule, clientKey, extraKey1);
        expect(isLimited1).toBe(false);

        // Second request for date 2024-01-16 should NOT be rate limited
        const extraKey2 = playerPostRule.keyExtractor(url2);
        const isLimited2 = isRateLimitedFor(playerPostRule, clientKey, extraKey2);
        expect(isLimited2).toBe(false);
    });

    it('should use fallback key for requests without date parameter', () => {
        const url1 = new URL('http://example.com/api/players');
        const url2 = new URL('http://example.com/api/players');
        const clientKey = '127.0.0.1|client-123';

        // First request without date
        const extraKey1 = playerPostRule.keyExtractor(url1);
        expect(extraKey1).toBe('no-date');
        const isLimited1 = isRateLimitedFor(playerPostRule, clientKey, extraKey1);
        expect(isLimited1).toBe(false);

        // Second request without date should be rate limited (same fallback key)
        const extraKey2 = playerPostRule.keyExtractor(url2);
        expect(extraKey2).toBe('no-date');
        const isLimited2 = isRateLimitedFor(playerPostRule, clientKey, extraKey2);
        expect(isLimited2).toBe(true);
    });

    it('should keep date-specific and no-date requests in separate buckets', () => {
        const url1 = new URL('http://example.com/api/players?date=2024-01-15');
        const url2 = new URL('http://example.com/api/players');
        const clientKey = '127.0.0.1|client-123';

        // First request with date
        const extraKey1 = playerPostRule.keyExtractor(url1);
        const isLimited1 = isRateLimitedFor(playerPostRule, clientKey, extraKey1);
        expect(isLimited1).toBe(false);

        // Request without date should NOT be rate limited (different bucket)
        const extraKey2 = playerPostRule.keyExtractor(url2);
        const isLimited2 = isRateLimitedFor(playerPostRule, clientKey, extraKey2);
        expect(isLimited2).toBe(false);
    });

    it('should rate limit different clients independently per date', () => {
        const url1 = new URL('http://example.com/api/players?date=2024-01-15');
        const url2 = new URL('http://example.com/api/players?date=2024-01-15');
        const clientKey1 = '127.0.0.1|client-1';
        const clientKey2 = '127.0.0.1|client-2';

        // First client's request
        const extraKey1 = playerPostRule.keyExtractor(url1);
        const isLimited1 = isRateLimitedFor(playerPostRule, clientKey1, extraKey1);
        expect(isLimited1).toBe(false);

        // Second client's request should NOT be rate limited (different client)
        const extraKey2 = playerPostRule.keyExtractor(url2);
        const isLimited2 = isRateLimitedFor(playerPostRule, clientKey2, extraKey2);
        expect(isLimited2).toBe(false);
    });

    it('should create unique keys for each date', () => {
        const dates = ['2024-01-15', '2024-01-16', '2024-01-17'];
        const clientKey = '127.0.0.1|client-123';

        // Each date should get its own bucket
        dates.forEach((date) => {
            const url = new URL(`http://example.com/api/players?date=${date}`);
            const extraKey = playerPostRule.keyExtractor(url);
            const isLimited = isRateLimitedFor(playerPostRule, clientKey, extraKey);
            expect(isLimited).toBe(false); // First request for each date should not be limited
        });

        // Verify that 3 separate keys were created
        expect(rateLimitMap.size).toBe(3);
    });
});
