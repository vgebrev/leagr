import { api } from './api-client.svelte.js';

class LeaguesService {
    /**
     * @param {{subdomain: string, name: string, icon: string, accessCode: string, adminCode?: string, ownerEmail?: string}} leagueData
     */
    async createLeague(leagueData) {
        return await api.postDirect('leagues', leagueData);
    }

    /** @param {string} resetCode */
    async validateResetCode(resetCode) {
        return await api.postDirect('leagues/validate-reset-code', { resetCode });
    }

    /**
     * @param {string} resetCode
     * @param {string} newAccessCode
     */
    async resetAccessCode(resetCode, newAccessCode) {
        return await api.postDirect('leagues/reset-access-code', { resetCode, newAccessCode });
    }

    /** @param {string} email */
    async forgotAccessCode(email) {
        return await api.postDirect('leagues/forgot-access-code', { email });
    }
}

export const leaguesService = new LeaguesService();
