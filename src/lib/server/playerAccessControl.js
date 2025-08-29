import crypto from 'crypto';

export class PlayerAccessControl {
    constructor() {
        this.date = null;
        this.leagueId = null;
        this.clientId = null;
        this.isAdmin = false;

        // Prefer dedicated salt, fallback to APP_URL to avoid hard breaking existing installs
        this.salt =
            process.env.PLAYER_OWNER_SALT ||
            import.meta.env.VITE_PLAYER_OWNER_SALT ||
            process.env.APP_URL ||
            import.meta.env.VITE_APP_URL ||
            'leagr-insecure-default-salt';
    }

    setContext(date, leagueId, clientId, isAdmin = false) {
        this.date = date;
        this.leagueId = leagueId;
        this.clientId = clientId;
        this.isAdmin = Boolean(isAdmin);
        return this;
    }

    /**
     * Derive a stable, non-reversible owner id from the client id
     * using HMAC-SHA256 with a server-side salt.
     */
    deriveOwnerId() {
        if (!this.clientId) return null;
        const h = crypto.createHmac('sha256', String(this.salt));
        h.update(`${this.leagueId || 'default'}|${this.date || ''}|${this.clientId}`);
        // Return a compact base64url string
        return h
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
            .slice(0, 22);
    }

    /**
     * Check if the provided owner id matches the current client.
     * If ownerId is null/undefined (legacy/no owner), we do not enforce.
     */
    isOwner(ownerId) {
        if (this.isAdmin) return true;
        if (!ownerId) return true; // do not enforce when owner mapping is absent
        const current = this.deriveOwnerId();
        return Boolean(current && current === ownerId);
    }
}

export const createPlayerAccessControl = () => new PlayerAccessControl();
