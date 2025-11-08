/**
 * Load function for year-in-review route
 * Passes the year parameter to the page component
 */
export function load({ params }) {
    return {
        year: params.year
    };
}
