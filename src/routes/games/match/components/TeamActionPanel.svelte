<script>
    import { Button } from 'flowbite-svelte';
    import { PlusOutline, MinusOutline } from 'flowbite-svelte-icons';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import { teamColours, teamStyles, titleCase } from '$lib/shared/helpers.js';
    import { RESERVED_SCORER_KEYS } from '$lib/shared/validation.js';

    let {
        teamName = '',
        players = [],
        match = null,
        side = 'home',
        onAction
    } = $props();

    /** @type {'goals'|'offensive'|'defensive'|'saves'} */
    let mode = $state('goals');

    let teamColour = $derived.by(() => {
        const firstWord = teamName?.split(' ')[0]?.toLowerCase() || '';
        return teamColours.includes(firstWord) ? firstWord : 'blue';
    });
    let styles = $derived(teamStyles[teamColour] || teamStyles.blue);

    const modes = [
        { id: 'goals', label: 'Goals', Icon: LeagueIcon, iconProps: { icon: "soccer"} },
        { id: 'offensive', label: 'Attack', Icon: BullseyeIcon },
        { id: 'defensive', label: 'Defence', Icon: ShieldIcon },
        { id: 'saves', label: 'Saves', Icon: GloveIcon }
    ];

    /**
     * @param {string} playerName
     * @returns {number}
     */
    function getCount(playerName) {
        if (!match) return 0;
        if (mode === 'goals') {
            return (side === 'home' ? match.homeScorers : match.awayScorers)?.[playerName] || 0;
        } else if (mode === 'offensive') {
            return (
                (side === 'home'
                    ? match.homeOffensiveActions
                    : match.awayOffensiveActions)?.[playerName] || 0
            );
        } else if (mode === 'defensive') {
            return (
                (side === 'home'
                    ? match.homeDefensiveActions
                    : match.awayDefensiveActions)?.[playerName] || 0
            );
        } else {
            return (side === 'home' ? match.homeSaveActions : match.awaySaveActions)?.[
                playerName
            ] || 0;
        }
    }
</script>

<div class="overflow-hidden rounded-md {styles.border} {styles.text}">
    <!-- Row 1: mode selector -->
    <div class="flex {styles.row}">
        {#each modes as { id, label, Icon, iconProps } (id)}
            <button
                type="button"
                class="flex flex-1 flex-col items-center gap-0.5 border-r border-l-0! border-t-0! px-1 py-1.5 text-xs font-medium last:border-r-0 {styles.border} {mode === id ? styles.header : ''}"
                onclick={() => (mode = id)}
                aria-pressed={mode === id}>
                <Icon {...iconProps} />
                {label}
            </button>
        {/each}
    </div>

    <!-- Player rows -->
    <div class="flex flex-col gap-0 p-1">
        {#each players as player (player)}
            {@const count = getCount(player)}
            <div class="flex items-center gap-1 py-0.5">
                <span class="min-w-0 flex-1 truncate text-sm">{player}</span>
                <Button
                    size="sm"
                    outline={true}
                    color="alternative"
                    class="p-0 {styles.buttonClass}"
                    onclick={() => onAction?.(side, player, mode, -1)}
                    disabled={count === 0}>
                    <MinusOutline class="h-4 w-4" />
                </Button>
                <span class="w-5 shrink-0 text-center text-sm font-bold">{count}</span>
                <Button
                    size="sm"
                    outline={true}
                    color="alternative"
                    class="p-0 {styles.buttonClass}"
                    onclick={() => onAction?.(side, player, mode, +1)}>
                    <PlusOutline class="h-4 w-4" />
                </Button>
            </div>
        {/each}
        {#if mode === 'goals' && players.length > 0}
            {@const ownGoalCount = getCount(RESERVED_SCORER_KEYS.OWN_GOAL)}
            <div class="mt-0.5 flex items-center gap-1 border-t border-white/20 pt-1">
                <span class="min-w-0 flex-1 truncate text-sm">Own Goal</span>
                <Button
                    size="sm"
                    outline={true}
                    color="alternative"
                    class="p-0 {styles.buttonClass}"
                    onclick={() => onAction?.(side, RESERVED_SCORER_KEYS.OWN_GOAL, 'goals', -1)}
                    disabled={ownGoalCount === 0}>
                    <MinusOutline class="h-4 w-4" />
                </Button>
                <span class="w-5 shrink-0 text-center text-sm font-bold">{ownGoalCount}</span>
                <Button
                    size="sm"
                    outline={true}
                    color="alternative"
                    class="p-0 {styles.buttonClass}"
                    onclick={() => onAction?.(side, RESERVED_SCORER_KEYS.OWN_GOAL, 'goals', +1)}
                    disabled={ownGoalCount >= 2}>
                    <PlusOutline class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    </div>
</div>
