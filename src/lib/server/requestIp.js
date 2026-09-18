/**
 * Normalises the client address taken from proxy headers.
 *
 * IIS ARR appends the client's ephemeral source port to X-Forwarded-For
 * (e.g. "41.126.237.163:46339"), so the same caller presents a different value
 * on every TCP connection. Because that value is part of the rate-limit key,
 * leaving the port on it means the key never repeats and the limits never
 * engage.
 *
 * @param {string} address - A single forwarded address, e.g. the first X-Forwarded-For entry
 * @returns {string} The address without its port
 */
export function stripPort(address) {
    const value = address.trim();
    if (!value) return value;

    // Bracketed IPv6, with or without a port: "[::1]" or "[::1]:443"
    if (value.startsWith('[')) {
        const end = value.indexOf(']');
        return end === -1 ? value : value.slice(1, end);
    }

    const firstColon = value.indexOf(':');
    if (firstColon === -1) return value;

    // A bare IPv6 address has several colons and never carries a port unbracketed,
    // so splitting on the first colon would truncate it.
    if (value.indexOf(':', firstColon + 1) !== -1) return value;

    return value.slice(0, firstColon);
}
