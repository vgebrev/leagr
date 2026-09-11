<script>
    import { Progressbar } from 'flowbite-svelte';
    import FantasySquadPreview from '$components/FantasySquadPreview.svelte';

    /**
     * The budget meter, and under it the squad itself — the same pitch view the leaderboard
     * opens in a modal, inline here so a pick is visible the moment it is made. The pitch is
     * also the controls: `slots` keeps an empty place on it for every pick still to make,
     * `onselect` opens the market from one, `onremove` takes a pick back, and `oncaptain`
     * moves the armband.
     * @typedef {{name: string, avatar?: string | null, elo?: number | null}} SquadPlayer
     * @type {{
     *   budget?: number,
     *   cost?: number,
     *   points?: number | null,
     *   players?: SquadPlayer[],
     *   playerStats?: Record<string, {price: number, points: number}>,
     *   withdrawnPlayers?: string[],
     *   slots?: number,
     *   captain?: string | null,
     *   onselect?: (playerName: string | null) => void,
     *   onremove?: (playerName: string) => void,
     *   oncaptain?: (playerName: string) => void
     * }}
     */
    let {
        budget = 0,
        cost = 0,
        points = null,
        players = [],
        playerStats = {},
        withdrawnPlayers = [],
        slots = 0,
        captain = null,
        onselect = undefined,
        onremove = undefined,
        oncaptain = undefined
    } = $props();

    let remaining = $derived(Math.round((budget - cost) * 2) / 2);
    let overBudget = $derived(remaining < 0);
    let spentPercent = $derived(budget > 0 ? Math.min(100, (cost / budget) * 100) : 0);
</script>

<div class="glass mb-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
    <div class="mb-1 flex items-baseline justify-between text-sm">
        <span class="font-bold">Squad</span>
        <span class="text-gray-500 dark:text-gray-400">
            <span
                class="font-bold {overBudget
                    ? 'text-primary-600'
                    : 'text-gray-900 dark:text-white'}">
                ${cost}m
            </span>
            / ${budget}m
        </span>
    </div>

    <Progressbar
        progress={spentPercent}
        size="h-1.5"
        color={overBudget ? 'primary' : 'secondary'}
        class="mb-2" />

    <div class="mb-2 flex items-baseline justify-between text-xs">
        <span class="text-gray-500 dark:text-gray-400">
            {#if overBudget}
                <span class="text-primary-600 font-bold">${Math.abs(remaining)}m over budget</span>
            {:else}
                <span>${remaining}m left</span>
            {/if}
        </span>
        {#if points !== null && points !== undefined}
            <!-- Only once the session has been settled; the meter is the squad's totals
                 line here, so the preview below does not repeat it. -->
            <span class="font-bold text-gray-900 dark:text-white">{points}pts</span>
        {/if}
    </div>

    <FantasySquadPreview
        {players}
        {playerStats}
        {withdrawnPlayers}
        {slots}
        {captain}
        {onselect}
        {onremove}
        {oncaptain}
        showTotals={false} />
</div>
