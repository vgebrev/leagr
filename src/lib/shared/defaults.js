/**
 * Centralised default values for the application
 */

/** @typedef {import('./types.js').DaySettings} DaySettings */
/** @typedef {import('./types.js').LeagueInfo} LeagueInfo */
/** @typedef {import('./types.js').LeagueSettings} LeagueSettings */

/**
 * Settings that can be overridden at the day level
 */
/** @type {(keyof DaySettings)[]} */
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
    'seedTeams',
    'discipline'
];

/**
 * Default league settings
 * @type {LeagueSettings}
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
    seedTeams: true,
    discipline: {
        enabled: true,
        noShowThreshold: 2
    }
};

export const defaultPlayers = {
    available: [],
    waitingList: []
};

/**
 * Get effective league settings by merging with defaults
 * @param {LeagueInfo | null | undefined} leagueInfo - League info object from server
 * @returns {LeagueSettings} - Merged league settings
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
 * @param {LeagueSettings} leagueSettings - League settings object
 * @returns {DaySettings} - Day-level settings with league defaults
 */
export function getDaySettingsDefaults(leagueSettings) {
    /** @type {DaySettings} */
    const dayDefaults = {
        playerLimit: leagueSettings.playerLimit
    };

    for (const settingKey of DAY_LEVEL_SETTINGS) {
        dayDefaults[settingKey] = leagueSettings[settingKey];
    }

    return dayDefaults;
}
