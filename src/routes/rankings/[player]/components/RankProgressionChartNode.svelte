<script>
    import { Popover } from 'flowbite-svelte';
    import AppearanceCard from '#components/AppearanceCard.svelte';
    import TrophyIcon from '#components/Icons/TrophyIcon.svelte';
    import CrownIcon from '#components/Icons/CrownIcon.svelte';
    import StarAwardIcon from '#components/StarAwardIcon.svelte';
    import { scale } from 'svelte/transition';

    /** @type {{ point: PlayerSessionDetail, x: number, y: number }} */
    let { point, x, y } = $props();
    const played = $derived(point.played !== false);

    // Stars of the Day row: below the trophy row, or directly under the node when the
    // session brought no trophy. Five icons at this size still fit inside one 60px
    // chart segment.
    const STAR_ICON = 10;
    const STAR_GAP = 1;
    const awards = $derived(played ? (point.awards ?? []) : []);
    const hasTrophy = $derived(played && (point.leagueWinner || point.cupWinner));
    const starsY = $derived(y + (hasTrophy ? 22 : 8));
    const starsWidth = $derived(awards.length * STAR_ICON + (awards.length - 1) * STAR_GAP);
    // For popover content, use the same point data since it includes all necessary fields
    const appearanceDetail = $derived(played ? point : null);

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
            ? 'cursor-pointer fill-gray-700 text-xs font-medium hover:opacity-80 dark:fill-gray-200'
            : 'cursor-pointer fill-gray-400 text-xs font-medium hover:opacity-80 dark:fill-gray-400'}
        text-anchor="middle">
        {point.rank}
    </text>

    <!-- Championship trophy icons -->
    {#if hasTrophy}
        <g>
            {#if point.leagueWinner && point.cupWinner}
                <!-- Both league and cup winner - show both icons side by side centered -->
                <foreignObject
                    x={x - 14}
                    y={y + 8}
                    width="12"
                    height="12">
                    <CrownIcon class="h-3 w-3 text-yellow-500" />
                </foreignObject>
                <foreignObject
                    x={x + 2}
                    y={y + 8}
                    width="12"
                    height="12">
                    <TrophyIcon class="h-3 w-3 text-amber-600" />
                </foreignObject>
            {:else if point.leagueWinner}
                <!-- League winner only -->
                <foreignObject
                    x={x - 6}
                    y={y + 8}
                    width="12"
                    height="12">
                    <CrownIcon class="h-3 w-3 text-yellow-500" />
                </foreignObject>
            {:else if point.cupWinner}
                <!-- Cup winner only -->
                <foreignObject
                    x={x - 6}
                    y={y + 8}
                    width="12"
                    height="12">
                    <TrophyIcon class="h-3 w-3 text-amber-600" />
                </foreignObject>
            {/if}
        </g>
    {/if}

    <!-- Stars of the Day icons -->
    {#each awards as award, i (award)}
        <foreignObject
            x={x - starsWidth / 2 + i * (STAR_ICON + STAR_GAP)}
            y={starsY}
            width={STAR_ICON}
            height={STAR_ICON}>
            <StarAwardIcon
                {award}
                class="block h-2.5 w-2.5 text-yellow-400" />
        </foreignObject>
    {/each}
</g>

<!-- Popover for this node -->
<Popover
    trigger="hover"
    title="Rank #{point.rank} • {point.rankingPoints} Ranking Points"
    transition={scale}
    class="drop-shadow-lg">
    {#if played && appearanceDetail}
        <AppearanceCard
            detail={appearanceDetail}
            hasBorder={false} />
    {:else}
        <div class="p-3 text-center text-gray-500 dark:text-gray-400">
            <p class="font-medium">Did not play</p>
            <p class="mt-1 text-xs">{formatDate(point.date)}</p>
        </div>
    {/if}
</Popover>
