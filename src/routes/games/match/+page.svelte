<script>
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import { settings } from '$lib/client/stores/settings.js';
    import { isCompetitionEnded } from '$lib/shared/helpers.js';
    import { Button, Input } from 'flowbite-svelte';
    import { AngleLeftOutline, AngleRightOutline } from 'flowbite-svelte-icons';
    import TeamBadge from '$components/TeamBadge.svelte';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import TeamActionPanel from './components/TeamActionPanel.svelte';
    import {
        gamesService,
        findLeagueMatch,
        findKnockoutMatch
    } from '$lib/client/services/games.svelte.js';
    import { RESERVED_SCORER_KEYS, validateGameScore } from '$lib/shared/validation.js';

    let { data } = $props();
    const date = data.date;

    // URL params
    let competition = $derived(page.url.searchParams.get('competition') || 'league');
    let roundParam = $derived(page.url.searchParams.get('round') || '1');
    let matchParam = $derived(page.url.searchParams.get('match') || '1');

    // Current match derived from service state
    let match = $derived(
        competition === 'league'
            ? findLeagueMatch(gamesService.schedule, roundParam, matchParam)
            : findKnockoutMatch(gamesService.knockoutBracket, roundParam, matchParam)
    );

    // Match label for the header
    let matchLabel = $derived.by(() => {
        if (!roundParam || !matchParam) return '';
        if (competition === 'league') {
            return `League · Round ${roundParam} · Match ${matchParam}`;
        }
        const roundNames = { quarter: 'Quarter Final', semi: 'Semi Final', final: 'Final' };
        const roundName =
            roundNames[roundParam] ||
            roundParam.charAt(0).toUpperCase() + roundParam.slice(1).replace('-', ' ');
        return `Cup · ${roundName} · Match ${matchParam}`;
    });

    // Players lists from teams data
    let homePlayers = $derived(getPlayerNames(gamesService.teams[match?.home]));
    let awayPlayers = $derived(getPlayerNames(gamesService.teams[match?.away]));

    /**
     * @param {Array<string|{name:string}>|undefined} teamPlayers
     * @returns {string[]}
     */
    function getPlayerNames(teamPlayers) {
        if (!teamPlayers) return [];
        return teamPlayers.filter(Boolean).map((p) => (typeof p === 'string' ? p : p.name));
    }

    /**
     * @param {'home'|'away'} side
     * @param {string} playerName
     * @param {'goals'|'offensive'|'defensive'|'saves'} mode
     * @param {number} delta
     */
    async function handleAction(side, playerName, mode, delta) {
        await gamesService.applyPlayerAction(
            competition,
            roundParam,
            matchParam,
            side,
            playerName,
            mode,
            delta
        );
    }

    // Manual score inputs
    let homeScoreError = $state('');
    let awayScoreError = $state('');
    let homePenaltyError = $state('');
    let awayPenaltyError = $state('');

    /**
     * @param {'home'|'away'} team
     * @param {Event} event
     */
    async function handleScoreChange(team, event) {
        const value = /** @type {HTMLInputElement} */ (event.target)?.value;
        if (team === 'home') homeScoreError = '';
        else awayScoreError = '';

        const validation = validateGameScore(
            value === '' ? null : parseInt(value),
            team === 'home' ? 'Home' : 'Away'
        );
        if (!validation.isValid) {
            if (team === 'home') homeScoreError = validation.errors[0] || 'Invalid score';
            else awayScoreError = validation.errors[0] || 'Invalid score';
            return;
        }

        if (!match) return;

        const numericValue = value === '' ? null : parseInt(value, 10);
        let homeScore = match.homeScore;
        let awayScore = match.awayScore;

        if (team === 'home') {
            homeScore = numericValue;
            if (numericValue === null) awayScore = null;
            else if (match.awayScore === null || match.awayScore === undefined) awayScore = 0;
        } else {
            awayScore = numericValue;
            if (numericValue === null) homeScore = null;
            else if (match.homeScore === null || match.homeScore === undefined) homeScore = 0;
        }

        // Clear stale penalty data when the main score is no longer a draw
        const updatedMatch = { ...match, homeScore, awayScore };
        if (homeScore === null || awayScore === null || homeScore !== awayScore) {
            updatedMatch.homePenalties = null;
            updatedMatch.awayPenalties = null;
            homePenaltyError = '';
            awayPenaltyError = '';
        }

        if (competition === 'league') {
            const roundIndex = parseInt(roundParam, 10) - 1;
            const matchIndex = parseInt(matchParam, 10) - 1;
            await gamesService.updateLeagueMatch(roundIndex, matchIndex, updatedMatch);
        } else {
            await gamesService.updateKnockoutMatch(updatedMatch);
        }
    }

    /**
     * @param {'home'|'away'} team
     * @param {Event} event
     */
    async function handlePenaltyChange(team, event) {
        const value = /** @type {HTMLInputElement} */ (event.target)?.value;
        if (team === 'home') homePenaltyError = '';
        else awayPenaltyError = '';

        const validation = validateGameScore(
            value === '' ? null : parseInt(value),
            team === 'home' ? 'Home penalties' : 'Away penalties'
        );
        if (!validation.isValid) {
            if (team === 'home') homePenaltyError = validation.errors[0] || 'Invalid score';
            else awayPenaltyError = validation.errors[0] || 'Invalid score';
            return;
        }

        if (!match) return;

        const numericValue = value === '' ? null : parseInt(value, 10);
        let homePenalties = match.homePenalties ?? null;
        let awayPenalties = match.awayPenalties ?? null;

        if (team === 'home') {
            homePenalties = numericValue;
            if (numericValue === null) awayPenalties = null;
            else if (match.awayPenalties == null) awayPenalties = 0;
        } else {
            awayPenalties = numericValue;
            if (numericValue === null) homePenalties = null;
            else if (match.homePenalties == null) homePenalties = 0;
        }

        const updatedMatch = { ...match, homePenalties, awayPenalties };
        await gamesService.updateKnockoutMatch(updatedMatch);
    }

    // Action summary: one row per action type, only rows with at least one entry
    const actionTypes = [
        {
            Icon: LeagueIcon,
            homeField: 'homeScorers',
            awayField: 'awayScorers'
        },
        {
            Icon: BullseyeIcon,
            homeField: 'homeOffensiveActions',
            awayField: 'awayOffensiveActions'
        },
        {
            Icon: ShieldIcon,
            homeField: 'homeDefensiveActions',
            awayField: 'awayDefensiveActions'
        },
        {
            Icon: GloveIcon,
            homeField: 'homeSaveActions',
            awayField: 'awaySaveActions'
        }
    ];

    /**
     * Format entries for one team's action field.
     * @param {Record<string,number>|null|undefined} actions
     * @returns {string}
     */
    /**
     * @param {Record<string,number>|null|undefined} actions
     * @returns {string[]}
     */
    function formatEntries(actions) {
        if (!actions) return [];
        return Object.entries(actions)
            .filter(([, count]) => count > 0)
            .map(([player, count]) => {
                const name = player === RESERVED_SCORER_KEYS.OWN_GOAL ? 'Own Goal' : player;
                return count > 1 ? `${name} (${count})` : name;
            });
    }

    let actionSummary = $derived.by(() => {
        if (!match) return [];
        return actionTypes
            .map(({ Icon, homeField, awayField }) => ({
                Icon,
                home: formatEntries(/** @type {any} */ (match)[homeField]),
                away: formatEntries(/** @type {any} */ (match)[awayField])
            }))
            .filter(({ home, away }) => home.length > 0 || away.length > 0);
    });

    let competitionEnded = $derived(isCompetitionEnded(date, $settings));

    let loaded = $state(false);

    onMount(async () => {
        await gamesService.loadForMatchTracker(date, competition);
        loaded = true;
    });

    // Next match navigation
    const KNOCKOUT_ROUND_ORDER = ['quarter', 'semi', 'final'];

    const KNOCKOUT_ROUND_NAMES = /** @type {Record<string,string>} */ ({
        quarter: 'Quarter Final',
        semi: 'Semi Final',
        final: 'Final'
    });

    /** @type {{ home: string, away: string, label: string, url: string } | null} */
    let nextMatchInfo = $derived.by(() => {
        if (!roundParam || !matchParam) return null;

        if (competition === 'league') {
            const schedule = gamesService.schedule;
            if (!schedule?.length) return null;

            const roundIndex = parseInt(roundParam, 10) - 1;
            const matchIndex = parseInt(matchParam, 10) - 1;

            // Next in same round
            for (let mi = matchIndex + 1; mi < (schedule[roundIndex]?.length ?? 0); mi++) {
                const m = schedule[roundIndex][mi];
                if (m && !m.bye) {
                    return {
                        home: m.home,
                        away: m.away,
                        label: `Round ${roundIndex + 1} · Match ${mi + 1}`,
                        url: `/games/match?date=${date}&competition=league&round=${roundIndex + 1}&match=${mi + 1}`
                    };
                }
            }
            // Next round(s)
            for (let ri = roundIndex + 1; ri < schedule.length; ri++) {
                for (let mi = 0; mi < (schedule[ri]?.length ?? 0); mi++) {
                    const m = schedule[ri][mi];
                    if (m && !m.bye) {
                        return {
                            home: m.home,
                            away: m.away,
                            label: `Round ${ri + 1} · Match ${mi + 1}`,
                            url: `/games/match?date=${date}&competition=league&round=${ri + 1}&match=${mi + 1}`
                        };
                    }
                }
            }
            return null;
        } else {
            const bracket = gamesService.knockoutBracket?.bracket;
            if (!bracket) return null;

            const currentMatchNum = parseInt(matchParam, 10);

            const sortedRounds = [...new Set(bracket.map((m) => m.round))].sort((a, b) => {
                const ia = KNOCKOUT_ROUND_ORDER.indexOf(a);
                const ib = KNOCKOUT_ROUND_ORDER.indexOf(b);
                if (ia === -1 && ib === -1) return a.localeCompare(b);
                if (ia === -1) return -1;
                if (ib === -1) return 1;
                return ia - ib;
            });

            const currentRoundIndex = sortedRounds.indexOf(roundParam);

            /** @param {string} round
             * @param {number} matchNum
             * @returns {string} */
            function knockoutLabel(round, matchNum) {
                const roundName =
                    KNOCKOUT_ROUND_NAMES[round] ||
                    round.charAt(0).toUpperCase() + round.slice(1).replace('-', ' ');
                return `${roundName} · Match ${matchNum}`;
            }

            // Next in same round (skip byes and unscheduled slots)
            const sameRoundNext = bracket
                .filter(
                    (m) =>
                        m.round === roundParam &&
                        m.match > currentMatchNum &&
                        !m.bye &&
                        m.home &&
                        m.away &&
                        m.home !== 'BYE' &&
                        m.away !== 'BYE'
                )
                .sort((a, b) => a.match - b.match)[0];

            if (sameRoundNext) {
                return {
                    home: sameRoundNext.home,
                    away: sameRoundNext.away,
                    label: knockoutLabel(sameRoundNext.round, sameRoundNext.match),
                    url: `/games/match?date=${date}&competition=knockout&round=${sameRoundNext.round}&match=${sameRoundNext.match}`
                };
            }

            // Next rounds
            for (let ri = currentRoundIndex + 1; ri < sortedRounds.length; ri++) {
                const nextRound = sortedRounds[ri];
                const nextRoundFirst = bracket
                    .filter(
                        (m) =>
                            m.round === nextRound &&
                            !m.bye &&
                            m.home &&
                            m.away &&
                            m.home !== 'BYE' &&
                            m.away !== 'BYE'
                    )
                    .sort((a, b) => a.match - b.match)[0];

                if (nextRoundFirst) {
                    return {
                        home: nextRoundFirst.home,
                        away: nextRoundFirst.away,
                        label: knockoutLabel(nextRoundFirst.round, nextRoundFirst.match),
                        url: `/games/match?date=${date}&competition=knockout&round=${nextRoundFirst.round}&match=${nextRoundFirst.match}`
                    };
                }
            }
            return null;
        }
    });

    /** @type {{ message: string, url: string } | null} */
    let completionState = $derived.by(() => {
        if (nextMatchInfo !== null) return null;
        if (competition === 'league') {
            if (!gamesService.schedule?.length) return null;
            return {
                message: 'League Completed. Start the Knockout Cup.',
                url: `/knockout?date=${date}`
            };
        } else {
            if (!gamesService.knockoutBracket?.bracket) return null;
            return {
                message: 'Competition Completed. Update Rankings.',
                url: `/rankings?date=${date}`
            };
        }
    });
</script>

<div class="flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-center gap-2">
        <div>
            <h5 class="flex items-center text-lg font-bold">Match Centre</h5>
            <p class="text-sm text-gray-600 dark:text-gray-400">{matchLabel}</p>
        </div>
    </div>

    {#if match}
        <!-- Score row -->
        <div class="glass w-full rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <img
                            src="/api/teams/logos/{encodeURIComponent(match.home)}?date={date}&size=128"
                            alt="{match.home} logo"
                            class="object-contain drop-shadow-lg drop-shadow-gray-950" />
                        <TeamBadge
                            teamName={match.home}
                            className="w-full" />
                    </div>
                    <span class="shrink-0 text-sm text-gray-600 dark:text-gray-400">vs</span>
                    <div class="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <img
                            src="/api/teams/logos/{encodeURIComponent(match.away)}?date={date}&size=128"
                            alt="{match.away} logo"
                            class="object-contain drop-shadow-lg drop-shadow-gray-950" />
                        <TeamBadge
                            teamName={match.away}
                            className="w-full" />
                    </div>
                </div>
                <div class="flex items-start justify-between">
                    <div class="flex w-2/5 flex-col items-center">
                        <Input
                            type="number"
                            size="md"
                            class="w-16! text-center! text-2xl! font-bold!"
                            disabled={competitionEnded}
                            value={match.homeScore?.toString() ?? ''}
                            onchange={(e) => handleScoreChange('home', e)}
                            onfocus={(e) => /** @type {HTMLInputElement} */ (e.target)?.select()}
                            min="0"
                            max="99"
                            aria-label="{match.home} score" />
                        {#if homeScoreError}
                            <span class="mt-1 text-xs text-red-500">{homeScoreError}</span>
                        {/if}
                    </div>
                    <div class="flex w-2/5 flex-col items-center">
                        <Input
                            type="number"
                            size="md"
                            class="w-16! text-center! text-2xl! font-bold!"
                            disabled={competitionEnded}
                            value={match.awayScore?.toString() ?? ''}
                            onchange={(e) => handleScoreChange('away', e)}
                            onfocus={(e) => /** @type {HTMLInputElement} */ (e.target)?.select()}
                            min="0"
                            max="99"
                            aria-label="{match.away} score" />
                        {#if awayScoreError}
                            <span class="mt-1 text-xs text-red-500">{awayScoreError}</span>
                        {/if}
                    </div>
                </div>
            </div>
            <!-- Penalty shootout (knockout only, when scores are a draw) -->
            {#if competition === 'knockout' && match.homeScore !== null && match.awayScore !== null && match.homeScore === match.awayScore}
                <div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <p class="mb-2 text-center text-sm">Penalty Shootout</p>
                    <div class="flex items-center justify-center gap-2">
                        <div class="flex flex-col items-center">
                            <Input
                                type="number"
                                size="sm"
                                class="text-center!"
                                disabled={competitionEnded}
                                value={match.homePenalties?.toString() ?? ''}
                                onchange={(e) => handlePenaltyChange('home', e)}
                                onfocus={(e) =>
                                    /** @type {HTMLInputElement} */ (e.target)?.select()}
                                min="0"
                                max="99"
                                aria-label="{match.home} penalties" />
                            {#if homePenaltyError}
                                <span class="mt-1 text-xs text-red-500">{homePenaltyError}</span>
                            {/if}
                        </div>
                        <span class="text-gray-600 dark:text-gray-400">–</span>
                        <div class="flex flex-col items-center">
                            <Input
                                type="number"
                                size="sm"
                                class="text-center!"
                                disabled={competitionEnded}
                                value={match.awayPenalties?.toString() ?? ''}
                                onchange={(e) => handlePenaltyChange('away', e)}
                                onfocus={(e) =>
                                    /** @type {HTMLInputElement} */ (e.target)?.select()}
                                min="0"
                                max="99"
                                aria-label="{match.away} penalties" />
                            {#if awayPenaltyError}
                                <span class="mt-1 text-xs text-red-500">{awayPenaltyError}</span>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}
            <!-- Action summary -->
            {#if actionSummary.length > 0}
                <div class="p-2">
                    {#each actionSummary as { Icon, home, away }, i (i)}
                        <div
                            class="flex items-center gap-2 border-t border-gray-200 py-0.5 dark:border-gray-700">
                            {#if home.length > 0}<Icon
                                    class="h-3 w-3 shrink-0 text-gray-600 dark:text-gray-400" />{:else}<span
                                    class="h-3 w-3 shrink-0"></span
                                >{/if}
                            <div
                                class="flex min-w-0 flex-1 flex-wrap gap-x-1 text-xs text-gray-600 dark:text-gray-400">
                                {#each home as entry, i (i)}
                                    <span class="whitespace-nowrap"
                                        >{entry}{#if i < home.length - 1},{/if}</span>
                                {/each}
                            </div>
                            <div
                                class="flex min-w-0 flex-1 flex-wrap justify-end gap-x-1 text-right text-xs text-gray-600 dark:text-gray-400">
                                {#each away as entry, i (i)}
                                    <span class="whitespace-nowrap"
                                        >{entry}{#if i < away.length - 1},{/if}</span>
                                {/each}
                            </div>
                            {#if away.length > 0}<Icon
                                    class="h-3 w-3 shrink-0 text-gray-600 dark:text-gray-400" />{:else}<span
                                    class="h-3 w-3 shrink-0"></span
                                >{/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Team action panels -->
        <div class="grid grid-cols-2 gap-2">
            <TeamActionPanel
                teamName={match.home}
                players={homePlayers}
                {match}
                side="home"
                disabled={competitionEnded}
                onAction={handleAction} />
            <TeamActionPanel
                teamName={match.away}
                players={awayPlayers}
                {match}
                side="away"
                disabled={competitionEnded}
                onAction={handleAction} />
        </div>
        <!-- Next Match / Completion -->
        {#if nextMatchInfo}
            <div class="glass w-full rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">
                    Next Match <span class="font-normal">· {nextMatchInfo.label}</span>
                </p>
                <div class="flex items-center gap-2">
                    <Button
                        outline
                        color="alternative"
                        size="xs"
                        class="me-auto p-1"
                        onclick={() => history.back()}><AngleLeftOutline class="h-3 w-3" /></Button>
                    <TeamBadge
                        teamName={nextMatchInfo.home}
                        className="min-w-0 flex-1" />
                    <span class="shrink-0 text-sm text-gray-600 dark:text-gray-400">vs</span>
                    <TeamBadge
                        teamName={nextMatchInfo.away}
                        className="min-w-0 flex-1" />
                    <Button
                        size="xs"
                        outline={true}
                        color="alternative"
                        href={resolve(nextMatchInfo.url, {})}
                        class="ms-auto p-1"
                        ><AngleRightOutline class="h-3 w-3" />
                    </Button>
                </div>
            </div>
        {:else if completionState}
            <div
                class="glass flex w-full items-center gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <Button
                    outline
                    color="alternative"
                    size="xs"
                    class="me-auto p-1"
                    onclick={() => history.back()}><AngleLeftOutline class="h-3 w-3" /></Button>
                <p class="text-sm text-gray-300">{completionState.message}</p>
                <Button
                    size="xs"
                    outline={true}
                    color="alternative"
                    href={resolve(completionState.url, {})}
                    class="ms-auto p-1">
                    <AngleRightOutline class="h-3 w-3" />
                </Button>
            </div>
        {/if}
    {:else}
        <p class="text-center text-sm text-gray-600 dark:text-gray-400">
            {#if loaded}
                No {competition}, round {roundParam}, match {matchParam} found.
            {:else}
                Loading match…
            {/if}
        </p>
    {/if}
</div>
