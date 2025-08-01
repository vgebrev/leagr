/**
 * Centralised default values for the application
 */

/**
 * Settings that can be overridden at the day level
 */
export const DAY_LEVEL_SETTINGS = ['playerLimit'];

/**
 * Settings that are only stored at the league level
 */
export const LEAGUE_ONLY_SETTINGS = [
    'competitionDays',
    'registrationWindow',
    'teamGeneration',
    'canRegenerateTeams',
    'canResetSchedule',
    'seedTeams'
];

/**
 * Default league settings
 * @type {{competitionDays: number[], registrationWindow: {enabled: boolean, startDayOffset: number, startTime: string, endDayOffset: number, endTime: string}, teamGeneration: {minTeams: number, maxTeams: number, minPlayersPerTeam: number, maxPlayersPerTeam: number}, playerLimit: number, canRegenerateTeams: boolean, canResetSchedule: boolean, seedTeams: boolean}}
 */
export const defaultSettings = {
    competitionDays: [6], // Array of weekdays (0=Sunday, 6=Saturday)
    registrationWindow: {
        enabled: true,
        startDayOffset: -2, // Days before competition day
        startTime: '07:30', // Time on start day
        endDayOffset: 0, // Days relative to competition day
        endTime: '12:00' // Time on end day
    },
    teamGeneration: {
        minTeams: 2,
        maxTeams: 5,
        minPlayersPerTeam: 5,
        maxPlayersPerTeam: 7
    },
    playerLimit: 24,
    canRegenerateTeams: false,
    canResetSchedule: false,
    seedTeams: true
};

export const defaultPlayers = {
    available: [],
    waitingList: []
};

/**
 * Get effective league settings by merging with defaults
 * @param {Object} leagueInfo - League info object from server
 * @returns {Object} - Merged league settings
 */
export function getEffectiveLeagueSettings(leagueInfo) {
    if (!leagueInfo) return defaultSettings;

    return {
        ...defaultSettings,
        ...leagueInfo.settings
    };
}

/**
 * Extract day-level settings defaults from league settings
 * @param {Object} leagueSettings - League settings object
 * @returns {Object} - Day-level settings with league defaults
 */
export function getDaySettingsDefaults(leagueSettings) {
    const dayDefaults = {};
    for (const settingKey of DAY_LEVEL_SETTINGS) {
        dayDefaults[settingKey] = leagueSettings[settingKey];
    }
    return dayDefaults;
}
