export const load = async ({ data }) => {
    return {
        date: data.date,
        settings: data.settings,
        apiKey: data.apiKey,
        leagueId: data.leagueId,
        leagueInfo: data.leagueInfo
    };
};
