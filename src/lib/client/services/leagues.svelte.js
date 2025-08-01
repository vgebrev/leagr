import { api } from './api-client.svelte.js';

class LeaguesService {
    async createLeague(leagueData) {
        return await api.postDirect('leagues', leagueData);
    }

    async validateResetCode(resetCode) {
        return await api.postDirect('leagues/validate-reset-code', { resetCode });
    }

    async resetAccessCode(resetCode, newAccessCode) {
        return await api.postDirect('leagues/reset-access-code', { resetCode, newAccessCode });
    }

    async forgotAccessCode(email) {
        return await api.postDirect('leagues/forgot-access-code', { email });
    }
}

export const leaguesService = new LeaguesService();
