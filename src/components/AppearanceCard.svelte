<script>
    import { Badge } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import { goto } from '$app/navigation';

    let { detail, hasBorder = true } = $props();

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

    /**
     * Navigate to table page for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     */
    function goToTableDate(date) {
        goto(`/table?date=${date}`);
    }
</script>

<div
    class="rounded-lg bg-white p-2 dark:bg-gray-800 {hasBorder
        ? 'border border-gray-200 shadow-md dark:border-gray-700'
        : ''}">
    <!-- Date and Team Header -->
    <div class="mb-3 flex items-center justify-between gap-2">
        <div class="shrink-0 text-sm font-semibold">
            {formatDate(detail.date)}
            {#if detail.leagueWinner || detail.cupWinner}
                <div class="mt-1 flex gap-1">
                    {#if detail.leagueWinner}
                        <Badge
                            color="yellow"
                            class="flex items-center gap-1 text-xs">
                            <CrownIcon class="h-3 w-3" />
                            League
                        </Badge>
                    {/if}
                    {#if detail.cupWinner}
                        <Badge
                            color="orange"
                            class="flex items-center gap-1 text-xs">
                            <TrophyIcon class="h-3 w-3" />
                            Cup
                        </Badge>
                    {/if}
                </div>
            {/if}
        </div>
        <div class="flex w-full items-center justify-end space-x-2">
            <button
                type="button"
                class="cursor-pointer transition-opacity hover:opacity-80"
                onclick={() => goToTableDate(detail.date)}
                title="View table for {formatDate(detail.date)}">
                <TeamBadge
                    teamName={detail.team}
                    className="text-sm w-full" />
            </button>
        </div>
    </div>

    <!-- Points Breakdown -->
    <div class="space-y-2">
        {#if detail.appearancePoints > 0}
            <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Appearance:</span>
                <Badge color="gray">
                    +{detail.appearancePoints}
                </Badge>
            </div>
        {/if}

        {#if detail.matchPoints > 0}
            <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Match Points:</span>
                <Badge color="gray">
                    +{detail.matchPoints}
                </Badge>
            </div>
        {/if}

        {#if detail.bonusPoints > 0}
            <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Bonus Points:</span>
                <Badge color="gray">
                    +{detail.bonusPoints}
                </Badge>
            </div>
        {/if}

        {#if detail.knockoutPoints > 0}
            <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Knockout Points:</span>
                <Badge color="gray">
                    +{detail.knockoutPoints}
                </Badge>
            </div>
        {/if}
    </div>

    <!-- Total -->
    <div
        class="mt-2 flex justify-between border-t border-t-gray-200 pt-2 font-semibold dark:border-t-gray-700">
        <span>Total:</span>
        <Badge
            color="gray"
            class="font-bold">
            {detail.totalPoints}
        </Badge>
    </div>
</div>
