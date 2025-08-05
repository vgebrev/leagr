<script>
    import { Popover } from 'flowbite-svelte';
    import AppearanceCard from './AppearanceCard.svelte';
    import { scale } from 'svelte/transition';

    let { point, x, y, playerData } = $props();
    const played = point.played !== false;
    const appearanceDetail = played
        ? playerData.sortedDetails.find((d) => d.date === point.date)
        : null;

    /**
     * Format date for display
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {string} Formatted date
     */
    function formatDate(date) {
        return new Date(date).toLocaleDateString('en-GB', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

<g>
    <!-- Data point circle -->
    <circle
        cx={x}
        cy={y}
        r="4"
        fill={played ? 'currentColor' : 'white'}
        class={played
            ? 'text-primary-700 dark:text-primary-700 cursor-pointer hover:opacity-80'
            : 'cursor-pointer hover:opacity-80 dark:fill-gray-800'}
        stroke={played ? 'none' : 'currentColor'}
        stroke-width={played ? '0' : '2'}>
    </circle>

    <!-- Rank number label -->
    <text
        {x}
        y={y - 8}
        class={played
            ? 'cursor-pointer fill-gray-700 text-xs font-medium hover:opacity-80 dark:fill-gray-300'
            : 'cursor-pointer fill-gray-400 text-xs font-medium hover:opacity-80 dark:fill-gray-500'}
        text-anchor="middle">
        {point.rank}
    </text>
</g>

<!-- Popover for this node -->
<Popover
    trigger="hover"
    title="Rank #{point.rank} • {point.points} Ranking Points"
    transition={scale}
    class="drop-shadow-lg">
    {#if played && appearanceDetail}
        <AppearanceCard detail={appearanceDetail} />
    {:else}
        <div class="p-3 text-center text-gray-500 dark:text-gray-400">
            <p class="font-medium">Did not play</p>
            <p class="mt-1 text-xs">{formatDate(point.date)}</p>
        </div>
    {/if}
</Popover>
