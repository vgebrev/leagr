/**
 * Admin "unlock session" state.
 *
 * Once a session's competition end time passes it becomes read-only, which makes
 * post-session corrections (a player who dropped out but was never removed from a
 * team, a mistyped score) impossible without hand-editing the session JSON. An
 * admin can explicitly unlock a single session to make those fixes.
 *
 * Deliberately in-memory only: a reload re-locks. The api-client mirrors
 * `unlockedDate` into the `x-admin-unlock` request header, so a session that was
 * never explicitly unlocked in this tab cannot be modified even by an admin.
 */
import { isCompetitionEnded } from '$lib/shared/helpers.js';

class SessionUnlockService {
    /** @type {string|null} YYYY-MM-DD an admin has explicitly unlocked for editing */
    unlockedDate = $state(null);

    /**
     * @param {string|null|undefined} date
     * @returns {boolean}
     */
    isUnlocked(date) {
        return Boolean(date) && this.unlockedDate === date;
    }

    /** @param {string|null|undefined} date */
    unlock(date) {
        this.unlockedDate = date || null;
    }

    lock() {
        this.unlockedDate = null;
    }
}

export const sessionUnlock = new SessionUnlockService();

/**
 * Canonical client-side "this session is read-only" predicate.
 * @param {string|null|undefined} date
 * @param {Object} settings
 * @returns {boolean}
 */
export function isSessionLocked(date, settings) {
    return isCompetitionEnded(date, settings) && !sessionUnlock.isUnlocked(date);
}
