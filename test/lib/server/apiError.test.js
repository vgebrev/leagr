import { describe, it, expect, beforeEach, vi } from 'vitest';
import { error, isHttpError } from '@sveltejs/kit';
import { toApiError } from '$lib/server/apiError.js';

vi.mock('$lib/server/logger.js', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

/**
 * toApiError exists because SvelteKit 2's error() throws rather than returns, so a
 * `return error(400, ...)` written inside a try block lands in that route's own catch.
 * Without the isHttpError guard those 4xx were re-reported to the client as a 500.
 */
describe('toApiError', () => {
    beforeEach(() => vi.clearAllMocks());

    /** Capture whatever toApiError throws. */
    function caught(err, fallback = 'fallback message', context) {
        try {
            toApiError(err, fallback, context);
            return { threw: false };
        } catch (thrown) {
            return { threw: true, thrown };
        }
    }

    it('re-throws an HttpError unchanged so SvelteKit still handles it', () => {
        let httpError;
        try {
            error(400, 'Penalty scores can only be set when main score is a draw');
        } catch (e) {
            httpError = e;
        }

        const { threw, thrown } = caught(httpError);

        expect(threw).toBe(true);
        expect(thrown).toBe(httpError);
        expect(isHttpError(thrown)).toBe(true);
        expect(thrown.status).toBe(400);
        expect(thrown.body.message).toBe(
            'Penalty scores can only be set when main score is a draw'
        );
    });

    it('preserves a 4xx rather than collapsing it into the fallback 500', () => {
        let httpError;
        try {
            error(404, 'League not found');
        } catch (e) {
            httpError = e;
        }

        const { thrown } = caught(httpError, 'Internal server error');

        expect(thrown.status).toBe(404);
        expect(thrown.status).not.toBe(500);
    });

    it('maps a domain error to its own statusCode and message', () => {
        class KnockoutError extends Error {
            constructor(message, statusCode) {
                super(message);
                this.name = 'KnockoutError';
                this.statusCode = statusCode;
            }
        }

        const { threw, thrown } = caught(
            new KnockoutError('No knockout tournament exists for this date', 400)
        );

        expect(threw).toBe(true);
        expect(isHttpError(thrown)).toBe(true);
        expect(thrown.status).toBe(400);
        expect(thrown.body.message).toBe('No knockout tournament exists for this date');
    });

    it('re-throws an unexpected error so handleError can log it with a stack', () => {
        const boom = new TypeError('cannot read properties of undefined');

        const { thrown } = caught(boom, 'Failed to update knockout scores', { date: '2026-09-05' });

        expect(thrown).toBe(boom);
        expect(isHttpError(thrown)).toBe(false);
    });

    it('annotates an unexpected error with the fallback message and context', () => {
        const boom = new Error('disk on fire');

        const { thrown } = caught(boom, 'Failed to update knockout scores', {
            date: '2026-09-05',
            leagueId: 'pirates'
        });

        expect(thrown.apiFallbackMessage).toBe('Failed to update knockout scores');
        expect(thrown.apiContext).toEqual({ date: '2026-09-05', leagueId: 'pirates' });
    });

    it('does not choke on a non-Error throw', () => {
        const { threw, thrown } = caught('a bare string');
        expect(threw).toBe(true);
        expect(thrown).toBe('a bare string');
    });
});
