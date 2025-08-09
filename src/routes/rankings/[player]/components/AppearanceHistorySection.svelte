<script>
    import AppearanceCard from '$components/AppearanceCard.svelte';

    let { playerData, limit = null } = $props();

    // Filter appearances (played sessions) and sort newest first
    const appearances = $derived(
        (playerData.details || [])
            .filter((d) => d.played && d.team) // Only appearances with team data
            .sort((a, b) => b.date.localeCompare(a.date)) // Newest first
    );

    // Check if we're showing limited data
    const isLimited = $derived(limit !== null && limit !== undefined);
    const labelPrefix = $derived(isLimited ? `Last ${limit}` : 'All');
</script>

<div>
    <div class="mb-2">
        <h2 class="text-lg font-semibold">Appearance History</h2>
        <p class="text-sm text-gray-500">Detailed breakdown of points earned per appearance</p>
    </div>

    {#if appearances.length === 0}
        <div class="py-8 text-center text-gray-500 dark:text-gray-400">
            No appearance data found for this player.
        </div>
    {:else}
        <!-- Session Cards Grid -->
        <div class="grid gap-2 sm:grid-cols-2">
            {#each appearances as detail (detail.date)}
                <AppearanceCard {detail} />
            {/each}
        </div>

        <!-- Summary Footer -->
        <div class="mt-2 border-t border-t-gray-200 pt-2 dark:border-t-gray-700">
            <div class="mb-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                {`${labelPrefix} Appearances Totals`}
            </div>
            <div class="grid grid-cols-5 text-sm">
                <div class="shrink-0 text-center">
                    <div
                        class="overflow-hidden text-ellipsis whitespace-nowrap text-gray-600 dark:text-gray-400">
                        Appearance
                    </div>
                    <div class="font-semibold">
                        {appearances.reduce((sum, d) => sum + d.appearancePoints, 0)}
                    </div>
                </div>
                <div class="shrink-0 text-center">
                    <div
                        class="overflow-hidden text-ellipsis whitespace-nowrap text-gray-600 dark:text-gray-400">
                        Match
                    </div>
                    <div class="font-semibold">
                        {appearances.reduce((sum, d) => sum + d.matchPoints, 0)}
                    </div>
                </div>
                <div class="shrink-0 text-center">
                    <div
                        class="overflow-hidden text-ellipsis whitespace-nowrap text-gray-600 dark:text-gray-400">
                        Bonus
                    </div>
                    <div class="font-semibold">
                        {appearances.reduce((sum, d) => sum + d.bonusPoints, 0)}
                    </div>
                </div>
                <div class="shrink-0 text-center">
                    <div
                        class="overflow-hidden text-ellipsis whitespace-nowrap text-gray-600 dark:text-gray-400">
                        Knockout
                    </div>
                    <div class="font-semibold">
                        {appearances.reduce((sum, d) => sum + d.knockoutPoints, 0)}
                    </div>
                </div>
                <div class="shrink-0 text-center">
                    <div
                        class="overflow-hidden text-ellipsis whitespace-nowrap text-gray-600 dark:text-gray-400">
                        Total
                    </div>
                    <div class="font-semibold">
                        {appearances.reduce((sum, d) => sum + d.totalPoints, 0)}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
