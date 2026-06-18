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
    'teamDrawRequiresAdmin',
    'discipline',
    'teamLogos',
    'momentum'
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
        teamDrawDayOffset: -1, // Days before competition day
        teamDrawTime: '16:00', // Time on team draw day
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
    teamDrawRequiresAdmin: false,
    discipline: {
        enabled: true,
        noShowThreshold: 2
    },
    teamLogos: {
        enabled: false
    },
    momentum: {
        enabled: true,
        // Half-lives in weeks; coolHalfLifeWeeks decays the signal on calendar time
        // between a player's last session and now. minSessions damps cold-start swings.
        ballers: {
            fastHalfLifeWeeks: 2,
            slowHalfLifeWeeks: 10,
            coolHalfLifeWeeks: 2,
            minSessions: 5
        },
        // Champions uses a slower fast EMA: placement reflects the team draw, so a
        // single lucky draw shouldn't spike a player to max heat.
        champions: {
            fastHalfLifeWeeks: 3,
            slowHalfLifeWeeks: 10,
            coolHalfLifeWeeks: 3,
            minSessions: 5
        }
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
 * Get effective momentum settings by deep-merging league overrides over defaults
 * (the top-level settings merge is shallow, so a partial momentum object would
 * otherwise lose nested defaults).
 * @param {Partial<LeagueSettings>|null|undefined} leagueSettings - Effective league settings
 * @returns {import('./types.js').MomentumSettings}
 */
export function getEffectiveMomentumSettings(leagueSettings) {
    const defaults = /** @type {import('./types.js').MomentumSettings} */ (
        defaultSettings.momentum
    );
    const overrides = leagueSettings?.momentum;
    return {
        enabled: overrides?.enabled ?? defaults.enabled,
        ballers: { ...defaults.ballers, ...overrides?.ballers },
        champions: { ...defaults.champions, ...overrides?.champions }
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
