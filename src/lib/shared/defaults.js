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
    'seedTeams',
    'discipline'
];

/** @typedef {Object} DaySettings
 * @property {number} playerLimit - Maximum number of players for the day
 */

/** @typedef {Object} LeagueSettings
 * @property {number[]} competitionDays - Array of weekdays (0=Sunday, 6=Saturday)
 * @property {Object} registrationWindow - Registration window settings
 * @property {boolean} registrationWindow.enabled - Whether registration is enabled
 * @property {number} registrationWindow.startDayOffset - Days before competition day to start registration
 * @property {string} registrationWindow.startTime - Time on start day (HH:mm)
 * @property {number} registrationWindow.endDayOffset - Days relative to competition day to end registration
 * @property {string} registrationWindow.endTime - Time on end day (HH:mm)
 * @property {Object} teamGeneration - Team generation settings
 * @property {number} teamGeneration.minTeams - Minimum number of teams
 * @property {number} teamGeneration.maxTeams - Maximum number of teams
 * @property {number} teamGeneration.minPlayersPerTeam - Minimum players per team
 * @property {number} teamGeneration.maxPlayersPerTeam - Maximum players per team
 * @property {number} playerLimit - Maximum number of players in the league
 * @property {boolean} canRegenerateTeams - Whether teams can be regenerated
 * @property {boolean} canResetSchedule - Whether the schedule can be reset
 * @property {boolean} seedTeams - Whether teams should be seeded
 * @property {Object} discipline - Discipline system settings
 * @property {boolean} discipline.enabled - Whether discipline system is enabled
 * @property {number} discipline.noShowThreshold - Number of no-shows before suspension
 */

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
 * @returns {DaySettings} - Day-level settings with league defaults
 */
export function getDaySettingsDefaults(leagueSettings) {
    const dayDefaults = {};
    for (const settingKey of DAY_LEVEL_SETTINGS) {
        dayDefaults[settingKey] = leagueSettings[settingKey];
    }
    return dayDefaults;
}
