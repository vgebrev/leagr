/**
 * Year configuration for rankings
 * Change MAX_YEAR for testing future years (e.g., set to 2026 to test with 2026 data)
 */

// Minimum year (app launch year)
export const MIN_YEAR = 2025;

// Maximum year (default to current year, but can be overridden for testing)
// To test with future data, change this to a future year (e.g., 2026)
export const MAX_YEAR = new Date().getFullYear();

/**
 * Get the current year for rankings (defaults to MAX_YEAR)
 * @returns {number} Current year
 */
export function getCurrentYear() {
    return MAX_YEAR;
}

/**
 * Get array of available years for selector
 * @returns {Array<{value: number, name: string}>}
 */
export function getYearOptions() {
    const years = [];
    for (let year = MAX_YEAR; year >= MIN_YEAR; year--) {
        years.push({ value: year, name: year.toString() });
    }
    return years;
}
