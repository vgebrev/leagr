<script>
    import { Modal } from 'flowbite-svelte';
    import { scale } from 'svelte/transition';
    import FantasySquadPreview from './FantasySquadPreview.svelte';

    /**
     * A fantasy squad on the pitch, for the leaderboard: a row opens its squad. The pick
     * screen shows the same preview inline instead, so everything below the header lives in
     * FantasySquadPreview.
     * @typedef {{name: string, avatar?: string | null, elo?: number | null}} SquadPlayer
     * @type {{
     *   teamName?: string | null,
     *   ownerName?: string | null,
     *   players?: SquadPlayer[],
     *   playerStats?: Record<string, {price: number, points: number}>,
     *   cost?: number | null,
     *   points?: number | null,
     *   withdrawnPlayers?: string[],
     *   captain?: string | null,
     *   open: boolean,
     *   onclose?: () => void
     * }}
     */
    let {
        teamName = null,
        ownerName = null,
        players = [],
        playerStats = {},
        cost = null,
        points = null,
        withdrawnPlayers = [],
        captain = null,
        open = $bindable(false),
        onclose = undefined
    } = $props();
</script>

<Modal
    transition={scale}
    bind:open
    oncancel={() => onclose?.()}
    size="md"
    class="glass-strong max-w-md border backdrop:backdrop-blur-xs"
    classes={{ body: 'p-2', close: 'p-0' }}>
    {#snippet header()}
        <div class="w-full pe-6 text-center">
            <div class="text-lg font-semibold">{teamName || 'Fantasy Squad'}</div>
            {#if ownerName}
                <div class="text-sm text-gray-500 dark:text-gray-400">{ownerName}</div>
            {/if}
        </div>
    {/snippet}

    <FantasySquadPreview
        {players}
        {playerStats}
        {cost}
        {points}
        {withdrawnPlayers}
        {captain} />
</Modal>
