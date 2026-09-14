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

    /**
     * What getConsolidatedSettings() returns: the league settings with a day-override
     * block nested under the session date, e.g. `settings['2026-09-05'].playerLimit`.
     * Those date keys are why this is not simply a LeagueSettings.
     */
    type ConsolidatedSettings = LeagueSettings & {
        [sessionDate: string]: DaySettings | LeagueSettings[keyof LeagueSettings];
    };

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

    /**
     * A match as it arrives from a client, before validation: any field may be absent and
     * scores may still be strings. validateRound()/validateMatchScores() turn one of these
     * into a Match.
     */
    interface RawMatch {
        home?: string;
        away?: string;
        homeScore?: number | string | null;
        awayScore?: number | string | null;
        homeScorers?: StatMap;
        awayScorers?: StatMap;
        homeOffensiveActions?: StatMap;
        awayOffensiveActions?: StatMap;
        homeDefensiveActions?: StatMap;
        awayDefensiveActions?: StatMap;
        homeSaveActions?: StatMap;
        awaySaveActions?: StatMap;
        bye?: boolean | string;
    }

    type RawRound = RawMatch[];

    interface RawScheduleData {
        anchorIndex?: number;
        rounds?: RawRound[];
    }

    interface KnockoutMatch extends Omit<Match, 'home' | 'away'> {
        /** null in a later round until the feeding round decides a winner. */
        home?: string | null;
        /** null in a later round until the feeding round decides a winner. */
        away?: string | null;
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

    /** The `games['knockout-games']` value: the seeded field plus its bracket. */
    interface KnockoutBracketData {
        teams: string[];
        bracket: KnockoutMatch[];
    }

    /**
     * Running statistics for one player pair while computeOverduePairs walks the session
     * history. The drought fields track the current unpaired run and stop accumulating
     * once the pair is seen together again.
     */
    interface PairStats {
        coAttendance: number;
        probNone: number;
        paired: boolean;
        droughtCoAttendance: number;
        droughtProbNone: number;
        droughtClosed: boolean;
    }

    /** One pair from computeOverduePairs, sorted most-starved first. */
    interface OverduePair {
        player1: string;
        player2: string;
        coAttendance: number;
        probNone: number;
        droughtCoAttendance?: number;
        droughtProbNone?: number;
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
    // Session file: data/{leagueId}/YYYY-MM-DD.json
    // ---------------------------------------------------------------------

    interface PlayersData {
        available: string[];
        waitingList: string[];
    }

    /**
     * teamName -> player slots. A slot is null when the team was drawn with a gap;
     * 24 of 273 stored team arrays contain one, so consumers must handle it.
     */
    type TeamsData = Record<string, Array<string | null>>;

    /** playerName -> HMAC client hash. Never leaves the server. */
    type OwnersMap = Record<string, string>;

    interface GameData {
        players?: PlayersData;
        teams?: TeamsData;
        settings?: LeagueSettings;
    }

    interface DataOptions {
        players?: boolean;
        teams?: boolean;
        settings?: boolean;
    }

    interface DrawHistoryStep {
        step: number;
        player: string;
        fromPot: number;
        toTeam: string;
        potPlayersRemaining: number;
    }

    interface DrawHistoryData {
        method: string;
        initialPots: Pot[];
        drawHistory: DrawHistoryStep[];
    }

    // ---------------------------------------------------------------------
    // Team generation
    // ---------------------------------------------------------------------

    interface PlayerTraits {
        isFinisher: boolean;
        isAttacker: boolean;
        isDefender: boolean;
        isShotStopper: boolean;
    }

    /** 0 = not held, 1 = held, 2 = elite. Keyed by the same names as PlayerTraits. */
    type TraitTiers = Record<keyof PlayerTraits, 0 | 1 | 2>;

    interface ProvisionalPlayerData {
        name: string;
        elo: number;
        actualElo: number;
        isProvisional: boolean;
        attackingRating: number;
        controlRating: number;
        avatar: string | null;
        appearances: number;
        traits: PlayerTraits;
        playerProfile: string[];
    }

    interface Pot {
        name: string;
        players: ProvisionalPlayerData[];
    }

    interface TeamConfig {
        teams: number;
        teamSizes: number[];
    }

    /** Contents of data/{leagueId}/teammate-history.json. */
    interface TeammateHistoryData {
        leagueId: string;
        /** Index order defines both matrix axes. */
        players: string[];
        /** P x P symmetric; matrix[i][j] is how often i and j were teammates. */
        matrix: number[][];
        totalSessions: number;
        lastUpdated: string;
        metadata: {
            totalPlayers: number;
            totalUniquePairs: number;
            maxPairings: number;
        };
    }

    // ---------------------------------------------------------------------
    // Rankings file: data/{leagueId}/rankings-YYYY.json
    // ---------------------------------------------------------------------

    interface PlayerElo {
        rating: number;
        lastDecayAt: string | null;
        gamesPlayed: number;
    }

    interface EloCarryOver {
        rating: number;
        gamesPlayed: number;
        lastAppearance?: string | null;
    }

    /** Per-session stat totals as stored in rankings history (short field names). */
    interface SessionStats {
        goals?: number | null;
        offActions?: number | null;
        defActions?: number | null;
        saveActions?: number | null;
    }

    /** Per-session stat totals as computed in rankings.js (long field names). */
    interface SessionStatTotals {
        goals: number;
        offensiveActions: number;
        defensiveActions: number;
        saveActions: number;
    }

    interface RankingPerformance {
        leaguePosition?: number | null;
        cupProgress?: string | null;
        leagueWinner?: boolean;
        cupWinner?: boolean;
    }

    interface PerSessionNorm {
        perSession: number | null;
        norm: number | null;
    }

    /**
     * Saves carry a volume half as well as a rate. The three volume fields are optional
     * only because the carry-forward pass rebuilds this object with perSession/norm and
     * the passes after it restore the rest; every persisted entry has all five.
     */
    interface SaveActionsRating {
        perSession: number | null;
        norm: number | null;
        total?: number | null;
        rateNorm?: number | null;
        volumeNorm?: number | null;
    }

    interface RankingRatings {
        elo: number;
        /**
         * A bare number is a legacy shape kept for older league files; every row in the
         * current data is the object form.
         */
        eloGames: { allTime: number; season: number } | number;
        attacking: number | null;
        control: number | null;
        teamGF: PerSessionNorm | null;
        teamGA: PerSessionNorm | null;
        goals: PerSessionNorm | null;
        offActions: PerSessionNorm | null;
        defActions: PerSessionNorm | null;
        saveActions: SaveActionsRating | null;
    }

    /**
     * One `players[name].history[date]` entry. `ratings` and `ranking` are always
     * written; the rest only on dates the player actually attended.
     */
    interface RankingHistoryEntry {
        team?: string;
        points?: {
            appearance: number;
            match: number;
            bonus: number;
            knockout: number;
            total: number;
        };
        performance?: RankingPerformance;
        stats?: SessionStats;
        ratings: RankingRatings;
        ranking: { rank: number; totalPlayers: number; rankingPoints: number };
    }

    interface PlayerRankingData {
        points: number;
        appearances: number;
        history: Record<string, RankingHistoryEntry>;
        elo: PlayerElo | null;
        seasonEloGames: number;
        indGoals: number;
        offActions: number;
        defActions: number;
        saveActions: number;
        sessionsWithGoals: number;
        sessionsWithOffActions: number;
        sessionsWithDefActions: number;
        sessionsWithSaveActions: number;
        sessionsInGoal: number;
        lastAppearance: string | null;
        rawAverage: number;
        weightedAverage: number;
        rankingPoints: number;
        pullFactor: number;
        hasFullConfidence: boolean;
        gamesUntilFullConfidence: number;
        rank: number;
        previousRank: number | null;
        rankMovement: number;
        isNew: boolean;
        leagueWins: number;
        cupWins: number;
        attackingRating: number | null;
        controlRating: number | null;
        goalsForPerSession: number | null;
        goalsAgainstPerSession: number | null;
        teamGFNorm: number | null;
        teamGANorm: number | null;
        goalsNorm: number | null;
        offActionsNorm: number | null;
        defActionsNorm: number | null;
        saveActionsNorm: number | null;
        traits: PlayerTraits;
        traitTiers: TraitTiers;
        playerProfile: string[];
        /**
         * Not persisted in rankings-YYYY.json. Merged in at runtime by
         * teamGenerationContext.mergeAvatars() so draw data carries avatars.
         */
        avatar?: string | null;
    }

    /** The minimum a player record needs to take part in a ranking pass. */
    interface RankablePlayer {
        points: number;
        appearances: number;
        history: Record<string, RankingHistoryEntry>;
        elo: PlayerElo | null;
    }

    /**
     * A record part-way through the rankings pipeline. calculateEnhancedRankings emits
     * these and assigns `rank`; rank movement, traits and norms are filled in by later
     * passes. Only the persisted rankings-YYYY.json holds complete PlayerRankingData.
     */
    type EnrichingPlayerRankingData = RankablePlayer &
        Partial<PlayerRankingData> & {
            /**
             * Session goal totals accumulated during the calculation and folded into
             * goalsForPerSession / goalsAgainstPerSession. Never persisted.
             */
            goalsFor?: number;
            goalsAgainst?: number;
        };

    /**
     * Rankings part-way through the pipeline. calculateEnhancedRankings takes and returns
     * this; traits, norms and rank movement are added by the passes after it, and only the
     * file written to disk is a complete RankingsData.
     */
    interface WorkingRankingsData {
        lastUpdated?: string | null;
        calculatedDates?: string[];
        players: Record<string, EnrichingPlayerRankingData>;
        rankingMetadata?: RankingMetadata;
    }

    /** The established-player value pools a date's norms are computed against. */
    interface RankingNormPools {
        gf: number[];
        ga: number[];
        goals: number[];
        off: number[];
        def: number[];
        save: number[];
        saveTotal: number[];
    }

    /** Which stat types a session actually recorded, so untracked ones don't dilute averages. */
    interface TrackedStatFlags {
        goals: boolean;
        offActions: boolean;
        defActions: boolean;
        saveActions: boolean;
    }

    /** One entry of STAT_SOURCES: which PlayerRankingData fields back a trait. */
    interface TraitStatSource {
        key: string;
        trait: keyof PlayerTraits;
        norm: 'goalsNorm' | 'offActionsNorm' | 'defActionsNorm' | 'saveActionsNorm';
        sessions:
            | 'sessionsWithGoals'
            | 'sessionsWithOffActions'
            | 'sessionsWithDefActions'
            | 'sessionsWithSaveActions'
            | 'sessionsInGoal';
    }

    interface RankingMetadata {
        globalAverage: number;
        minAverage: number;
        maxAppearances: number;
        confidenceThreshold: number;
        confidenceFraction?: number;
        pullStrength?: number;
        totalPlayers?: number;
        lastCalculated: string;
    }

    interface RankingsData {
        lastUpdated: string | null;
        calculatedDates: string[];
        players: Record<string, PlayerRankingData>;
        rankingMetadata?: RankingMetadata;
    }

    /** Rankings players reduced to just their history - what the feed builders consume. */
    type PlayersWithHistory = Record<string, { history?: Record<string, RankingHistoryEntry> }>;

    interface MatchResult {
        home: string;
        away: string;
        homeScore: number;
        awayScore: number;
    }

    interface TeamStats {
        points: number;
        gf: number;
        ga: number;
    }

    // ---------------------------------------------------------------------
    // Discipline: data/{leagueId}/discipline.json
    // ---------------------------------------------------------------------

    interface Suspension {
        date: string;
        reason: string;
        applied: string;
    }

    interface DisciplineRecord {
        activeNoShows: string[];
        clearedNoShows: Array<{ date: string; clearedOn: string }>;
        suspensions: Suspension[];
        totalSuspensions: number;
        revertedSuspensions?: Array<Suspension & { revertedOn: string }>;
    }

    interface SuspensionStatus {
        suspended: boolean;
        reason?: string;
        suspension?: Suspension;
        /** Set when the match was made by fuzzy name comparison rather than exactly. */
        fuzzyMatch?: boolean;
        similarity?: number;
        matchedPlayer?: string;
        isSuspended?: boolean;
        hasActiveNoShows?: boolean;
        newSuspension?: boolean;
    }

    type FuzzySuspensionMatch =
        | { isMatch: false }
        | {
              isMatch: true;
              matchedPlayer: string;
              similarity: number;
              isSuspended: boolean;
              hasActiveNoShows: boolean;
              activeNoShowCount: number;
              suspension: Suspension | null;
          };

    interface DisciplineData {
        lastUpdated: string | null;
        players: Record<string, DisciplineRecord>;
    }

    // ---------------------------------------------------------------------
    // Avatars, logos, noun pool
    // ---------------------------------------------------------------------

    /** As stored: a field is absent rather than null when the player has no such avatar. */
    interface PlayerAvatarRecord {
        avatar?: string;
        pendingAvatar?: string;
    }

    /**
     * Payload for updatePlayerAvatar. Distinct from PlayerAvatarRecord because `null` here
     * means "clear this field" - the manager deletes the key rather than storing a null.
     */
    interface PlayerAvatarUpdate {
        avatar?: string | null;
        pendingAvatar?: string | null;
    }

    /** Contents of data/{leagueId}/avatars.json. */
    type AvatarsData = Record<string, PlayerAvatarRecord>;

    /** Contents of data/{leagueId}/logos.json: `${date}_${teamName}` -> filename. */
    type LogosMap = Record<string, string>;

    interface NounPool {
        shuffledNouns: string[];
        currentIndex: number;
        cycleCount: number;
    }

    interface NounPoolStatus {
        currentIndex: number;
        totalNouns: number;
        cycleCount: number;
        percentUsed: number;
    }

    // ---------------------------------------------------------------------
    // Momentum and news feed (derived, not persisted)
    // ---------------------------------------------------------------------

    interface MomentumEntry {
        playerName: string;
        value: number;
        sessions: number;
        provisional: boolean;
        lastSession: string;
        components: Record<string, number>;
        series: Array<{ date: string; value: number }>;
        trophyStreak?: Array<{ league: boolean; cup: boolean }>;
        woodenSpoonStreak?: number;
        badges?: Array<{ type: string; count: number }>;
    }

    interface Thread {
        type: string;
        notability: number;
        player?: string;
        streak?: number;
        category?: string;
        outcome?: 'extended' | 'broken' | 'started' | 'carriedOver';
        position?: number;
        board?: string;
        value?: number;
        swing?: number;
        team?: string;
        runnerUp?: string | null;
        finalist?: string | null;
        points?: number | null;
        margin?: number | null;
        gd?: { winner: number; runnerUp: number } | null;
        double?: boolean;
        invincible?: boolean;
        winners?: Array<{ category: string; players: string[]; value: number }>;
    }

    interface Card {
        date: string;
        state: 'preview' | 'recap';
        threads: Thread[];
    }

    // ---------------------------------------------------------------------
    // Fantasy: data/{leagueId}/fantasy/YYYY-MM-DD.json
    // ---------------------------------------------------------------------

    interface FantasyEntry {
        /** HMAC client hash; never leaves the server. */
        owner: string;
        /** The owner's own registered player, resolved at save time. */
        ownerName: string | null;
        teamName: string;
        players: string[];
        /** One of `players`, scored twice; null for a squad with none. */
        captain: string | null;
        cost: number;
        points: number | null;
        createdAt: string;
        updatedAt: string;
    }

    interface FantasyPriceMeta {
        expectedPoints: number;
        provisional: boolean;
        elo: number | null;
        sessions: number;
    }

    /** The board as persisted once the week locks. */
    interface FrozenBoard {
        lockedAt: string;
        asOf: string | null;
        regime: string[];
        budget: number;
        squadSize: number;
        prices: Record<string, number>;
        meta: Record<string, FantasyPriceMeta>;
    }

    /** One session on a player's fantasy timeline, as buildTimeline emits it. */
    interface FantasyTimelineEntry {
        date: string;
        elo: number | null;
        attended: boolean;
        scored: SessionFantasyPoints | null;
    }

    /** Intermediate accumulator inside expectedPointsSnapshot, before the prior is applied. */
    interface FantasyDraftEntry {
        playerName: string;
        observations: Array<{ date: string; value: number }>;
        attendedDates: Set<string>;
        sessionDates: string[];
        elo: number | null;
        emaMean: number | null;
        breakdown: Record<string, number> | null;
    }

    /** A player's expected-points snapshot: what a price is computed from. */
    interface ExpectedPointsEntry {
        playerName: string;
        expectedPointsPerSession: number;
        sessions: number;
        provisional: boolean;
        elo: number | null;
        credibility: number;
        prior: number;
        lastSession: string | null;
        observedMean: number | null;
        breakdown: Record<string, number> | null;
        attendedDates: Set<string>;
        sessionDates: string[];
        /**
         * Added in place by priceSnapshot(), which scales expected points by availability
         * and maps the result onto the price band. Absent until that pass has run.
         */
        availability?: number;
        attendanceRate?: number;
        expectedWeeklyPoints?: number;
        suspended?: boolean;
        scoringWeights?: FantasyScoringConfig;
        targetPrice?: number;
        /** Added by the season replay in buildPrices(), once the price band is damped. */
        price?: number;
        previousPrice?: number | null;
        change?: number;
    }

    interface PriceEntry {
        playerName: string;
        price: number;
        expectedPoints: number;
        observedMean: number | null;
        breakdown: Record<string, number>;
        sessions: number;
        provisional: boolean;
        credibility: number;
        prior: number;
        elo: number | null;
    }

    /** The board before it locks; #resolveBoard re-expands a FrozenBoard into this. */
    interface LiveBoard {
        asOf: string | null;
        regime: string[];
        budget: number;
        squadSize: number;
        prices: PriceEntry[];
        locked?: boolean;
    }

    interface FantasyPointsBreakdown {
        appearance: number;
        goals: number;
        offActions: number;
        defActions: number;
        saveActions: number;
        results: number;
        trophies: number;
    }

    interface SessionFantasyPoints {
        total: number;
        breakdown: FantasyPointsBreakdown;
    }

    interface FantasyResults {
        settledAt: string;
        playerPoints: Record<string, SessionFantasyPoints>;
    }

    interface FantasyFile {
        date: string;
        board: FrozenBoard | null;
        entries: FantasyEntry[];
        results: FantasyResults | null;
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
