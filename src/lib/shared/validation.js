/**
 * Validate if a string is a valid subdomain
 * @param {string} subdomain - The subdomain to validate
 * @returns {boolean} - Whether the subdomain is valid
 */
export function isValidSubdomain(subdomain) {
    if (!subdomain || typeof subdomain !== 'string') return false;

    // Check length (1-63 characters)
    if (subdomain.length < 1 || subdomain.length > 63) return false;

    // Check pattern: alphanumeric and hyphens, but not starting/ending with hyphen
    const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    return subdomainRegex.test(subdomain);
}

/**
 * Generate a human-friendly access code
 * @returns {string} - Access code in format XXXX-XXXX-XXXX
 */
export function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const groups = [];

    for (let group = 0; group < 3; group++) {
        let groupCode = '';
        for (let i = 0; i < 4; i++) {
            groupCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        groups.push(groupCode);
    }

    return groups.join('-');
}
