<script>
    import { Modal } from 'flowbite-svelte';
    import { ChartMixedOutline, TagOutline } from 'flowbite-svelte-icons';
    import { scale } from 'svelte/transition';
    import TeamFormation from './TeamFormation.svelte';

    /**
     * A fantasy squad on the pitch. Unlike TeamModal this loads nothing of its own — the
     * squad, its prices and its points all come from one /api/fantasy payload the caller
     * already holds, so there is nothing left to fetch.
     * @typedef {{name: string, avatar?: string | null, elo?: number | null}} SquadPlayer
     * @type {{
     *   teamName?: string | null,
     *   ownerName?: string | null,
     *   players?: SquadPlayer[],
     *   playerStats?: Record<string, {price: number, points: number}>,
     *   cost?: number | null,
     *   points?: number | null,
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
        open = $bindable(false),
        onclose = undefined
    } = $props();

    // A fantasy squad has no colour or crest of its own, so the formation renders neutral.
    const statDefs = [
        { key: 'price', label: 'price', Icon: TagOutline },
        { key: 'points', label: 'pts', Icon: ChartMixedOutline, divider: true }
    ];
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

    {#if players.length}
        <div class="mb-2 flex items-center justify-center gap-4 text-sm">
            <span class="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <TagOutline class="h-4 w-4" />
                <span class="font-bold text-gray-900 dark:text-white">{cost ?? '—'}</span>
            </span>
            <span class="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <ChartMixedOutline class="h-4 w-4" />
                <span class="font-bold text-gray-900 dark:text-white">
                    {points === null || points === undefined ? '—' : points}
                </span>
            </span>
        </div>
        <TeamFormation
            {players}
            {playerStats}
            {statDefs}
            teamColor="default" />
    {:else}
        <div class="p-4 text-center text-gray-500">No players picked yet</div>
    {/if}
</Modal>
