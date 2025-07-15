import { api } from './api-client.svelte.js';

class LeaguesService {
    async createLeague(leagueData) {
        return await api.postDirect('leagues', leagueData);
    }
}

export const leaguesService = new LeaguesService();
