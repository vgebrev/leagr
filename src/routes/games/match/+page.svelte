<script>
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import { Input } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
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
    let roundParam = $derived(page.url.searchParams.get('round'));
    let matchParam = $derived(page.url.searchParams.get('match'));

    // Back link
    let backUrl = $derived(
        competition === 'league'
            ? `/games?date=${date}`
            : `/knockout?date=${date}`
    );

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
            return `Round ${roundParam} · Match ${matchParam}`;
        }
        const roundNames = { quarter: 'Quarter Final', semi: 'Semi Final', final: 'Final' };
        const roundName =
            roundNames[roundParam] ||
            roundParam.charAt(0).toUpperCase() + roundParam.slice(1).replace('-', ' ');
        return `${roundName} · Match ${matchParam}`;
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
        return teamPlayers.map((p) => (typeof p === 'string' ? p : p.name));
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

        const updatedMatch = { ...match, homeScore, awayScore };

        if (competition === 'league') {
            const roundIndex = parseInt(roundParam, 10) - 1;
            const matchIndex = parseInt(matchParam, 10) - 1;
            await gamesService.updateLeagueMatch(roundIndex, matchIndex, updatedMatch);
        } else {
            await gamesService.updateKnockoutMatch(updatedMatch);
        }
    }

    // Action summary: one row per action type, only rows with at least one entry
    const actionTypes = [
        {
            Icon: SoccerBootIcon,
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
    function formatEntries(actions) {
        if (!actions) return '';
        return Object.entries(actions)
            .filter(([, count]) => count > 0)
            .map(([player, count]) => {
                const name = player === RESERVED_SCORER_KEYS.OWN_GOAL ? 'OG' : player;
                return count > 1 ? `${name} ${count}` : name;
            })
            .join(', ');
    }

    let actionSummary = $derived.by(() => {
        if (!match) return [];
        return actionTypes
            .map(({ Icon, homeField, awayField }) => ({
                Icon,
                home: formatEntries(/** @type {any} */ (match)[homeField]),
                away: formatEntries(/** @type {any} */ (match)[awayField])
            }))
            .filter(({ home, away }) => home || away);
    });

    onMount(async () => {
        await gamesService.loadForMatchTracker(date, competition);
    });
</script>

<div class="flex flex-col gap-3">
    <!-- Header: back + label -->
    <div class="flex items-center gap-2">
        <a
            href={resolve(backUrl, {})}
            class="text-sm text-gray-400 hover:text-gray-200">← Back</a>
        <span class="text-sm text-gray-400">{matchLabel}</span>
    </div>

    {#if match}
        <!-- Score row -->
        <div class="glass flex items-center justify-between rounded-lg p-3">
            <TeamBadge
                teamName={match.home}
                className="w-2/5" />
            <div class="flex items-center gap-2">
                <div class="flex flex-col items-center">
                    <Input
                        type="number"
                        size="md"
                        class="w-16! text-center!"
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
                <span class="text-gray-400">–</span>
                <div class="flex flex-col items-center">
                    <Input
                        type="number"
                        size="md"
                        class="w-16! text-center!"
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
            <TeamBadge
                teamName={match.away}
                className="w-2/5" />
        </div>

        <!-- Team action panels -->
        <div class="grid grid-cols-2 gap-2">
            <TeamActionPanel
                teamName={match.home}
                players={homePlayers}
                {match}
                side="home"
                onAction={handleAction} />
            <TeamActionPanel
                teamName={match.away}
                players={awayPlayers}
                {match}
                side="away"
                onAction={handleAction} />
        </div>

        <!-- Action summary -->
        {#if actionSummary.length > 0}
            <div class="glass rounded-lg p-2">
                {#each actionSummary as { Icon, home, away }}
                    <div class="flex items-start gap-2 py-0.5">
                        <Icon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span class="min-w-0 flex-1 truncate text-xs text-gray-300"
                            >{home || '—'}</span>
                        <span class="shrink-0 text-xs text-gray-600">|</span>
                        <span class="min-w-0 flex-1 truncate text-right text-xs text-gray-300"
                            >{away || '—'}</span>
                    </div>
                {/each}
            </div>
        {/if}
    {:else}
        <p class="text-center text-sm text-gray-400">Loading match…</p>
    {/if}
</div>
