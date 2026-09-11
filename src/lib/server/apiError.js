import { error, isHttpError } from '@sveltejs/kit';
import { logger } from './logger.js';

/**
 * Convert an error caught in an API route into the right HTTP response.
 *
 * SvelteKit 2's `error()` throws rather than returns, so a `return error(400, ...)`
 * written inside a `try` lands in that route's own `catch`. Without the
 * `isHttpError` guard below, those legitimate 4xx responses get swallowed and
 * re-reported as a generic 500.
 *
 * Unexpected errors are re-thrown so the `handleError` hook logs them once, with
 * a stack and a correlation id, instead of each route logging its own variant.
 *
 * @param {unknown} err - The caught error
 * @param {string} fallbackMessage - Client-facing message for unexpected failures
 * @param {Record<string, unknown>} [context] - Extra detail for the log line
 * @returns {never}
 */
export function toApiError(err, fallbackMessage, context = {}) {
    // Framework errors from error() are already a finished response — let them through.
    if (isHttpError(err)) {
        throw err;
    }

    // Domain errors (KnockoutError, PlayerError, TeamError, ...) carry their own status.
    if (typeof (/** @type {any} */ (err)?.statusCode) === 'number') {
        const domainError = /** @type {{ name: string, message: string, statusCode: number }} */ (
            err
        );
        logger.warn(`${domainError.name}: ${domainError.message}`, {
            status: domainError.statusCode,
            ...context
        });
        error(domainError.statusCode, domainError.message);
    }

    // Genuinely unexpected — annotate for handleError, then let it bubble.
    if (err instanceof Error) {
        Object.assign(err, { apiFallbackMessage: fallbackMessage, apiContext: context });
    }
    throw err;
}
