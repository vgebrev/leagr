/**
 * Shared JSDoc typedefs for client/server usage.
 */

/**
 * @typedef {Object} TeamStyle
 * @property {string} text
 * @property {string} header
 * @property {string} row
 * @property {string} button
 * @property {string} buttonClass
 * @property {string} border
 * @property {string[]} confetti
 */

/**
 * @typedef {'blue'|'white'|'orange'|'green'|'black'|'red'|'gray'|'default'} TeamColour
 */

/**
 * @typedef {Object} RegistrationWindow
 * @property {boolean} enabled
 * @property {number} startDayOffset
 * @property {string} startTime
 * @property {number} endDayOffset
 * @property {string} endTime
 */

/**
 * @typedef {Object} TeamGenerationSettings
 * @property {number} minTeams
 * @property {number} maxTeams
 * @property {number} minPlayersPerTeam
 * @property {number} maxPlayersPerTeam
 */

/**
 * @typedef {Object} DisciplineSettings
 * @property {boolean} enabled
 * @property {number} noShowThreshold
 */

/**
 * @typedef {Object} DaySettings
 * @property {number} playerLimit
 */

/**
 * @typedef {Object} LeagueSettings
 * @property {number[]} competitionDays
 * @property {RegistrationWindow} registrationWindow
 * @property {TeamGenerationSettings} teamGeneration
 * @property {number} playerLimit
 * @property {boolean} canRegenerateTeams
 * @property {boolean} canResetSchedule
 * @property {boolean} seedTeams
 * @property {DisciplineSettings} discipline
 */

/**
 * @typedef {Object} LeagueInfo
 * @property {string} [name]
 * @property {string} [accessCode]
 * @property {string} [adminCode]
 * @property {string} [ownerEmail]
 * @property {string} [resetCode]
 * @property {string} [resetCodeExpiry]
 * @property {LeagueSettings} [settings]
 */

/**
 * @typedef {Object} Match
 * @property {string} [home]
 * @property {string} [away]
 * @property {number|null} [homeScore]
 * @property {number|null} [awayScore]
 * @property {string[]} [homeScorers]
 * @property {string[]} [awayScorers]
 * @property {boolean} [bye]
 */

/** @typedef {Match[]} Round */

/**
 * @typedef {Object} ScheduleData
 * @property {number} [anchorIndex]
 * @property {Round[]} rounds
 */

export {};
