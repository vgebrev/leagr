export const load = async ({ data }) => {
    return {
        date: data.date,
        settings: data.settings,
        apiKey: data.apiKey,
        appUrl: data.appUrl,
        leagueId: data.leagueId,
        leagueInfo: data.leagueInfo
    };
};
