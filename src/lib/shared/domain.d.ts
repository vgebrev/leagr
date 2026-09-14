/**
 * Shared domain types.
 *
 * Everything here is ambient: use `Match`, `LeagueSettings`, `PlayerRankingData` etc.
 * directly in any .js or .svelte file, with no import and no
 * `@typedef {import('...')}` preamble. See CLAUDE.md -> Typing Rules.
 */

declare global {
    // ---------------------------------------------------------------------
    // Teams and presentation
    // ---------------------------------------------------------------------

    type TeamColour = 'blue' | 'white' | 'orange' | 'green' | 'black' | 'red' | 'gray' | 'default';

    interface TeamLogoPrompt {
        primary: string;
        secondary: string[];
    }

    interface TeamStyle {
        text: string;
        header: string;
        row: string;
        button: string;
        buttonClass: string;
        border: string;
        /**
         * Raw hex for canvas/SVG use, where a Tailwind class cannot be applied.
         * Set on the five drawable team colours only, not on the red/gray/default fallbacks.
         */
        bgHex?: string;
        confetti: string[];
        logoPrompt?: TeamLogoPrompt;
    }

    // ---------------------------------------------------------------------
    // Settings
    // ---------------------------------------------------------------------

    interface RegistrationWindow {
        enabled: boolean;
        startDayOffset: number;
        startTime: string;
        teamDrawDayOffset?: number;
        teamDrawTime?: string;
        endDayOffset: number;
        endTime: string;
    }

    interface TeamGenerationSettings {
        minTeams: number;
        maxTeams: number;
        minPlayersPerTeam: number;
        maxPlayersPerTeam: number;
    }

    interface DisciplineSettings {
        enabled: boolean;
        noShowThreshold: number;
    }

    interface DaySettings {
        playerLimit: number;
    }

    interface TeamLogosSettings {
        enabled: boolean;
    }

    interface MomentumBoardConfig {
        fastHalfLifeWeeks: number;
        slowHalfLifeWeeks: number;
        coolHalfLifeWeeks: number;
        minSessions: number;
    }

    interface MomentumSettings {
        enabled: boolean;
        ballers: MomentumBoardConfig;
        champions: MomentumBoardConfig;
    }

    interface FantasyScoringConfig {
        appearance: number;
        goal: number;
        offAction: number;
        defAction: number;
        save: number;
        matchPoint: number;
        knockout: number;
        leagueWin: number;
        cupWin: number;
    }

    interface FantasyPricingConfig {
        floor: number;
        ceiling: number;
        step: number;
        anchorPercentile: number;
        poolFloorPercentile: number;
        maxWeeklyMove: number;
        halfLifeWeeks: number;
        credibilityK: number;
        minSessions: number;
    }

    interface FantasyAvailabilityConfig {
        halfLifeWeeks: number;
        priorStrength: number;
        noShowPenalty: number;
        floor: number;
    }

    interface FantasySquadConfig {
        size: number;
        affordability: number;
    }

    /** Fully resolved config - DEFAULT_FANTASY_CONFIG deep-merged with FantasySettings. */
    interface FantasyConfig {
        scoring: FantasyScoringConfig;
        pricing: FantasyPricingConfig;
        availability: FantasyAvailabilityConfig;
        squad: FantasySquadConfig;
    }

    /**
     * Per-league overrides for the weekly fantasy game. Every sub-object is partial:
     * only the keys a league actually sets need to be present, and resolveFantasyConfig()
     * supplies the rest from DEFAULT_FANTASY_CONFIG.
     */
    interface FantasySettings {
        scoring?: Partial<FantasyScoringConfig>;
        pricing?: Partial<FantasyPricingConfig>;
        availability?: Partial<FantasyAvailabilityConfig>;
        squad?: Partial<FantasySquadConfig>;
    }

    interface LeagueSettings {
        competitionDays: number[];
        registrationWindow: RegistrationWindow;
        teamGeneration: TeamGenerationSettings;
        playerLimit: number;
        gameDurationMinutes?: number;
        lastPlayEnabled?: boolean;
        lastPlaySeconds?: number;
        canRegenerateTeams: boolean;
        canResetSchedule: boolean;
        seedTeams: boolean;
        teamDrawRequiresAdmin?: boolean;
        discipline: DisciplineSettings;
        teamLogos?: TeamLogosSettings;
        momentum?: MomentumSettings;
        fantasy?: FantasySettings;
    }

    /** Contents of data/{leagueId}/info.json. */
    interface LeagueInfo {
        id: string;
        icon?: string;
        name?: string;
        accessCode?: string;
        adminCode?: string;
        ownerEmail?: string;
        resetCode?: string;
        resetCodeExpiry?: string;
        settings?: LeagueSettings;
    }

    // ---------------------------------------------------------------------
    // Matches and schedules
    // ---------------------------------------------------------------------

    /** playerName -> count, or null when nothing was recorded for that side. */
    type StatMap = Record<string, number> | null;

    interface Match {
        home?: string;
        away?: string;
        homeScore?: number | null;
        awayScore?: number | null;
        homeScorers?: StatMap;
        awayScorers?: StatMap;
        homeOffensiveActions?: StatMap;
        awayOffensiveActions?: StatMap;
        homeDefensiveActions?: StatMap;
        awayDefensiveActions?: StatMap;
        homeSaveActions?: StatMap;
        awaySaveActions?: StatMap;
        /** `true` in a knockout bracket; the bye team's name in a round robin. */
        bye?: boolean | string;
    }

    interface KnockoutMatch extends Match {
        round?: string;
        match?: number;
        homePenalties?: number | null;
        awayPenalties?: number | null;
    }

    type Round = Match[];

    interface ScheduleData {
        anchorIndex?: number;
        rounds: Round[];
    }

    interface ScheduleStatus {
        isComplete: boolean;
        playedGames: number;
        totalGames: number;
    }

    /** The `games` key of a daily session file. */
    interface SessionGames extends ScheduleData {
        status?: ScheduleStatus;
        teamCount?: number;
        'knockout-games'?: { teams: string[]; bracket: KnockoutMatch[] };
    }

    interface StandingsRow {
        team: string;
        played: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
        points: number;
    }

    // ---------------------------------------------------------------------
    // Year recap
    // ---------------------------------------------------------------------

    interface YearRecapOverview {
        totalSessions: number;
        totalMatches: number;
        totalPlayers: number;
        totalGoals: number;
        firstSession: string;
        lastSession: string;
    }

    interface YearRecapPlayerAvatar {
        name: string;
        avatarUrl: string | null;
    }

    type YearRecapIronManEntry = YearRecapPlayerAvatar & {
        appearances: number;
        totalGames: number;
        rankingPoints: number;
    };

    type YearRecapMostImprovedEntry = YearRecapPlayerAvatar & {
        startingRank: number;
        lowestRank: number;
        currentRank: number;
        rankImprovement: number;
        rankingPoints: number;
    };

    type YearRecapKingOfKingsEntry = YearRecapPlayerAvatar & {
        leagueWins: number;
        cupWins: number;
        totalTrophies: number;
        rankingPoints: number;
    };

    type YearRecapPlayerVotesEntry = YearRecapPlayerAvatar & { votes: number };

    interface YearRecapPlayersFavourite {
        topThree: YearRecapPlayerVotesEntry[];
        otherNominations: YearRecapPlayerVotesEntry[];
    }

    type YearRecapPlayerOfYearEntry = YearRecapPlayerAvatar & {
        rankingPoints: number;
        rank: number;
        appearances: number;
        ptsPerAppearance: number;
    };

    type YearRecapTeamOfYearEntry = YearRecapPlayerAvatar & {
        rankingPoints: number;
        rank: number;
    };

    type YearRecapDreamTeamEntry = YearRecapPlayerAvatar & {
        eloRating: number;
        gamesPlayed: number;
    };

    interface YearRecapTeamRecord {
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
    }

    interface YearRecapTeamHighlight {
        sessionDate: string;
        teamName: string;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        totalGames: number;
        points: number;
        totalAvailablePoints: number;
        pointsPercentage: number;
        players: YearRecapPlayerAvatar[];
        leagueRecord: YearRecapTeamRecord;
        cupRecord: YearRecapTeamRecord;
        honorableMentions: Array<{
            sessionDate: string;
            teamName: string;
            pointsPercentage: number;
        }>;
    }

    interface YearRecapTrueColoursEntry {
        color: string;
        leagueWins: number;
        cupWins: number;
        wins: number;
        draws: number;
        losses: number;
        topPlayers: Array<YearRecapPlayerAvatar & { caps: number }>;
    }

    type YearRecapBottleEntry = YearRecapPlayerAvatar & { count: number };

    interface YearRecapBottle {
        leagueSecond: YearRecapBottleEntry[];
        cupFinalLosses: YearRecapBottleEntry[];
    }

    interface YearRecapMatchFact {
        date: string;
        home: string;
        away: string;
        homeScore: number;
        awayScore: number;
        totalGoals: number;
    }

    interface YearRecapMarginFact {
        date: string;
        home: string;
        away: string;
        homeScore: number;
        awayScore: number;
        margin: number;
    }

    interface YearRecapGoalsSession {
        date: string;
        goals: number;
    }

    interface YearRecapFunFacts {
        highestScoringMatch: YearRecapMatchFact | null;
        biggestMarginWin: YearRecapMarginFact | null;
        mostGoalsSession: YearRecapGoalsSession | null;
        fewestGoalsSession: YearRecapGoalsSession | null;
    }

    interface YearRecapData {
        overview: YearRecapOverview;
        ironManAward: YearRecapIronManEntry[];
        mostImproved: YearRecapMostImprovedEntry[];
        kingOfKings: YearRecapKingOfKingsEntry[];
        playersFavourite: YearRecapPlayersFavourite | null;
        playerOfYear: YearRecapPlayerOfYearEntry[];
        teamOfYear: YearRecapTeamOfYearEntry[];
        dreamTeam: YearRecapDreamTeamEntry[];
        invincibles: YearRecapTeamHighlight | null;
        underdogs: YearRecapTeamHighlight | null;
        trueColours: YearRecapTrueColoursEntry[];
        bottle: YearRecapBottle;
        funFacts: YearRecapFunFacts;
    }
}

export {};
