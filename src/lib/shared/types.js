/**
 * Shared JSDoc typedefs for client/server usage.
 */

/**
 * @typedef {Object} TeamLogoPrompt
 * @property {string} primary
 * @property {string[]} secondary
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
 * @property {TeamLogoPrompt} [logoPrompt]
 */

/**
 * @typedef {'blue'|'white'|'orange'|'green'|'black'|'red'|'gray'|'default'} TeamColour
 */

/**
 * @typedef {Object} RegistrationWindow
 * @property {boolean} enabled
 * @property {number} startDayOffset
 * @property {string} startTime
 * @property {number} [teamDrawDayOffset]
 * @property {string} [teamDrawTime]
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
 * @typedef {Object} TeamLogosSettings
 * @property {boolean} enabled
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
 * @property {boolean} [teamDrawRequiresAdmin]
 * @property {DisciplineSettings} discipline
 * @property {TeamLogosSettings} [teamLogos]
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

/**
 * @typedef {Object} YearRecapOverview
 * @property {number} totalSessions
 * @property {number} totalMatches
 * @property {number} totalPlayers
 * @property {number} totalGoals
 * @property {string} firstSession
 * @property {string} lastSession
 */

/**
 * @typedef {Object} YearRecapPlayerAvatar
 * @property {string} name
 * @property {string | null} avatarUrl
 */

/**
 * @typedef {YearRecapPlayerAvatar & {
 *  appearances: number,
 *  totalGames: number,
 *  rankingPoints: number
 * }} YearRecapIronManEntry
 */

/**
 * @typedef {YearRecapPlayerAvatar & {
 *  startingRank: number,
 *  lowestRank: number,
 *  currentRank: number,
 *  rankImprovement: number,
 *  rankingPoints: number
 * }} YearRecapMostImprovedEntry
 */

/**
 * @typedef {YearRecapPlayerAvatar & {
 *  leagueWins: number,
 *  cupWins: number,
 *  totalTrophies: number,
 *  rankingPoints: number
 * }} YearRecapKingOfKingsEntry
 */

/**
 * @typedef {YearRecapPlayerAvatar & {
 *  votes: number
 * }} YearRecapPlayerVotesEntry
 */

/**
 * @typedef {Object} YearRecapPlayersFavourite
 * @property {YearRecapPlayerVotesEntry[]} topThree
 * @property {YearRecapPlayerVotesEntry[]} otherNominations
 */

/**
 * @typedef {YearRecapPlayerAvatar & {
 *  rankingPoints: number,
 *  rank: number,
 *  appearances: number,
 *  ptsPerAppearance: number
 * }} YearRecapPlayerOfYearEntry
 */

/**
 * @typedef {YearRecapPlayerAvatar & {
 *  rankingPoints: number,
 *  rank: number
 * }} YearRecapTeamOfYearEntry
 */

/**
 * @typedef {YearRecapPlayerAvatar & {
 *  eloRating: number,
 *  gamesPlayed: number
 * }} YearRecapDreamTeamEntry
 */

/**
 * @typedef {Object} YearRecapTeamRecord
 * @property {number} wins
 * @property {number} draws
 * @property {number} losses
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 */

/**
 * @typedef {Object} YearRecapTeamHighlight
 * @property {string} sessionDate
 * @property {string} teamName
 * @property {number} wins
 * @property {number} draws
 * @property {number} losses
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 * @property {number} goalDifference
 * @property {number} totalGames
 * @property {number} points
 * @property {number} totalAvailablePoints
 * @property {number} pointsPercentage
 * @property {YearRecapPlayerAvatar[]} players
 * @property {YearRecapTeamRecord} leagueRecord
 * @property {YearRecapTeamRecord} cupRecord
 * @property {Array<{ sessionDate: string, teamName: string, pointsPercentage: number }>} honorableMentions
 */

/**
 * @typedef {Object} YearRecapTrueColoursEntry
 * @property {string} color
 * @property {number} leagueWins
 * @property {number} cupWins
 * @property {number} wins
 * @property {number} draws
 * @property {number} losses
 * @property {Array<YearRecapPlayerAvatar & { caps: number }>} topPlayers
 */

/**
 * @typedef {YearRecapPlayerAvatar & { count: number }} YearRecapBottleEntry
 */

/**
 * @typedef {Object} YearRecapBottle
 * @property {YearRecapBottleEntry[]} leagueSecond
 * @property {YearRecapBottleEntry[]} cupFinalLosses
 */

/**
 * @typedef {Object} YearRecapMatchFact
 * @property {string} date
 * @property {string} home
 * @property {string} away
 * @property {number} homeScore
 * @property {number} awayScore
 * @property {number} totalGoals
 */

/**
 * @typedef {Object} YearRecapMarginFact
 * @property {string} date
 * @property {string} home
 * @property {string} away
 * @property {number} homeScore
 * @property {number} awayScore
 * @property {number} margin
 */

/**
 * @typedef {Object} YearRecapGoalsSession
 * @property {string} date
 * @property {number} goals
 */

/**
 * @typedef {Object} YearRecapFunFacts
 * @property {YearRecapMatchFact | null} highestScoringMatch
 * @property {YearRecapMarginFact | null} biggestMarginWin
 * @property {YearRecapGoalsSession | null} mostGoalsSession
 * @property {YearRecapGoalsSession | null} fewestGoalsSession
 */

/**
 * @typedef {Object} YearRecapData
 * @property {YearRecapOverview} overview
 * @property {YearRecapIronManEntry[]} ironManAward
 * @property {YearRecapMostImprovedEntry[]} mostImproved
 * @property {YearRecapKingOfKingsEntry[]} kingOfKings
 * @property {YearRecapPlayersFavourite | null} playersFavourite
 * @property {YearRecapPlayerOfYearEntry[]} playerOfYear
 * @property {YearRecapTeamOfYearEntry[]} teamOfYear
 * @property {YearRecapDreamTeamEntry[]} dreamTeam
 * @property {YearRecapTeamHighlight | null} invincibles
 * @property {YearRecapTeamHighlight | null} underdogs
 * @property {YearRecapTrueColoursEntry[]} trueColours
 * @property {YearRecapBottle} bottle
 * @property {YearRecapFunFacts} funFacts
 */

export {};
