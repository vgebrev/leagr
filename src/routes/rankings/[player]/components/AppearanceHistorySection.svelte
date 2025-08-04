<script>
    import AppearanceCard from './AppearanceCard.svelte';

    let { playerData } = $props();
</script>

<div>
    <div class="mb-4">
        <h2 class="text-lg font-semibold">Appearance History</h2>
        <p class="text-sm text-gray-500">Detailed breakdown of points earned per appearance</p>
    </div>

    {#if playerData.sortedDetails.length === 0}
        <div class="py-8 text-center text-gray-500 dark:text-gray-400">
            No appearance data found for this player.
        </div>
    {:else}
        <!-- Session Cards Grid -->
        <div class="grid gap-4 sm:grid-cols-2">
            {#each playerData.sortedDetails as detail (detail.date)}
                <AppearanceCard {detail} />
            {/each}
        </div>

        <!-- Summary Footer -->
        <div class="mt-4 border-t border-t-gray-200 pt-4 dark:border-t-gray-700">
            <div class="grid grid-cols-5 gap-4 text-sm">
                <div class="text-center">
                    <div class="text-gray-600 dark:text-gray-400">Total Appearance</div>
                    <div class="font-semibold">
                        {playerData.sortedDetails.reduce((sum, d) => sum + d.appearancePoints, 0)}
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-gray-600 dark:text-gray-400">Total Match</div>
                    <div class="font-semibold">
                        {playerData.sortedDetails.reduce((sum, d) => sum + d.matchPoints, 0)}
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-gray-600 dark:text-gray-400">Total Bonus</div>
                    <div class="font-semibold">
                        {playerData.sortedDetails.reduce((sum, d) => sum + d.bonusPoints, 0)}
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-gray-600 dark:text-gray-400">Total Knockout</div>
                    <div class="font-semibold">
                        {playerData.sortedDetails.reduce((sum, d) => sum + d.knockoutPoints, 0)}
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-gray-600 dark:text-gray-400">Grand Total</div>
                    <div class="font-semibold">
                        {playerData.points}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
