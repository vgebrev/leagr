/**
 * Global settings cache to reduce disk I/O for frequently accessed settings data
 * Provides league isolation and automatic TTL expiration
 */
class GlobalSettingsCache {
    #cache = new Map(); // key: "leagueId:date", value: { data, timestamp }

    // Cache TTL settings
    static TTL_MS = 5 * 60 * 1000; // 5-minutes TTL for settings

    /**
     * Generate cache key ensuring league isolation
     * @param {string} leagueId
     * @param {string} date
     * @returns {string}
     */
    #getCacheKey(leagueId, date) {
        return `${leagueId}:${date}`;
    }

    /**
     * Check if cache entry has expired
     * @param {Object} entry - Cache entry with timestamp
     * @returns {boolean}
     */
    #isExpired(entry) {
        return Date.now() - entry.timestamp > GlobalSettingsCache.TTL_MS;
    }

    /**
     * Get cached settings data
     * @param {string} leagueId
     * @param {string} date
     * @returns {Object|null} - Cached settings or null if not found/expired
     */
    get(leagueId, date) {
        const key = this.#getCacheKey(leagueId, date);
        const entry = this.#cache.get(key);

        if (!entry) {
            return null;
        }

        if (this.#isExpired(entry)) {
            this.#cache.delete(key);
            return null;
        }

        // Return deep clone to prevent mutation of cached data
        return structuredClone(entry.data);
    }

    /**
     * Store settings data in cache
     * @param {string} leagueId
     * @param {string} date
     * @param {Object} data - Settings data to cache
     */
    set(leagueId, date, data) {
        const key = this.#getCacheKey(leagueId, date);

        // Store deep clone to prevent mutation of cached data
        this.#cache.set(key, {
            data: structuredClone(data),
            timestamp: Date.now()
        });
    }

    /**
     * Invalidate specific date settings for a league
     * @param {string} leagueId
     * @param {string} date
     */
    invalidate(leagueId, date) {
        const key = this.#getCacheKey(leagueId, date);
        this.#cache.delete(key);
    }

    /**
     * Invalidate all settings for a specific league
     * @param {string} leagueId
     */
    invalidateLeague(leagueId) {
        const prefix = `${leagueId}:`;

        for (const key of this.#cache.keys()) {
            if (key.startsWith(prefix)) {
                this.#cache.delete(key);
            }
        }
    }

    /**
     * Clear all cached settings (useful for testing)
     */
    clear() {
        this.#cache.clear();
    }

    /**
     * Get cache statistics for monitoring
     * @returns {Object}
     */
    getStats() {
        const now = Date.now();
        let activeEntries = 0;
        let expiredEntries = 0;

        for (const entry of this.#cache.values()) {
            if (now - entry.timestamp > GlobalSettingsCache.TTL_MS) {
                expiredEntries++;
            } else {
                activeEntries++;
            }
        }

        return {
            totalEntries: this.#cache.size,
            activeEntries,
            expiredEntries,
            ttlMs: GlobalSettingsCache.TTL_MS
        };
    }

    /**
     * Clean up expired entries (can be called periodically)
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, entry] of this.#cache.entries()) {
            if (now - entry.timestamp > GlobalSettingsCache.TTL_MS) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.#cache.delete(key);
        }

        return expiredKeys.length;
    }
}

// Export singleton instance
export const globalSettingsCache = new GlobalSettingsCache();

/**
 * Invalidate settings cache when settings are modified
 * Call this from settings modification APIs
 * @param {string} leagueId
 * @param {?string} date - Optional, if provided invalidates only that date
 */
export function invalidateSettingsCache(leagueId, date = null) {
    if (date) {
        globalSettingsCache.invalidate(leagueId, date);
    } else {
        globalSettingsCache.invalidateLeague(leagueId);
    }
}
