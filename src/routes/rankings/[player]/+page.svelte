<script>
    import { Card, Badge } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    let { data } = $props();
    const { player, playerData } = data;

    let celebrating = $state(false);

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

    /**
     * Trigger celebration if player is #1
     */
    onMount(() => {
        if (playerData.rank === 1) {
            celebrating = true;
        }
    });
</script>

<svelte:head>
    <title>{player} - Player Rankings Detail | Leagr</title>
</svelte:head>

<div class="container mx-auto">
    <!-- Header -->
    <div class="mb-4">
        <h1 class="text-2xl font-bold">{player}</h1>
        <p class="text-gray-600">Ranking Detail History</p>
    </div>

    <!-- Player Summary Card -->
    <div class="mb-6">
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Current Rank</div>
                <div class="text-2xl font-bold">#{playerData.rank}</div>
            </div>
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Ranking Points</div>
                <div class="text-2xl font-bold">{playerData.rankingPoints}</div>
            </div>
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Total Points</div>
                <div class="text-2xl font-bold">{playerData.points}</div>
            </div>
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Appearances</div>
                <div class="text-2xl font-bold">{playerData.appearances}</div>
            </div>
        </div>

        {#if playerData.rawAverage && playerData.weightedAverage}
            <div
                class="mt-4 grid grid-cols-2 gap-4 border-t border-t-gray-200 pt-4 md:grid-cols-3 dark:border-t-gray-700">
                <div class="text-center">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Raw Average</div>
                    <div class="text-lg font-semibold">{playerData.rawAverage}</div>
                </div>
                <div class="text-center">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Weighted Average</div>
                    <div class="text-lg font-semibold">{playerData.weightedAverage}</div>
                </div>
                <div class="text-center">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Full Confidence</div>
                    <div class="text-lg font-semibold">
                        {playerData.hasFullConfidence
                            ? 'Yes'
                            : `${playerData.gamesUntilFullConfidence} more`}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Detailed History -->
    <div>
        <div class="mb-4">
            <h2 class="text-xl font-semibold">Appearance History</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
                Detailed breakdown of points earned per appearance
            </p>
        </div>

        {#if playerData.sortedDetails.length === 0}
            <div class="py-8 text-center text-gray-500 dark:text-gray-400">
                No appearance data found for this player.
            </div>
        {:else}
            <!-- Session Cards Grid -->
            <div class="grid gap-4 sm:grid-cols-2">
                {#each playerData.sortedDetails as detail (detail.date)}
                    <Card class="p-4">
                        <!-- Date and Team Header -->
                        <div class="mb-3 flex items-center justify-between gap-2">
                            <div class="shrink-0 text-sm font-semibold">
                                {formatDate(detail.date)}
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
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Appearance:</span>
                                    <Badge color="gray">
                                        +{detail.appearancePoints}
                                    </Badge>
                                </div>
                            {/if}

                            {#if detail.matchPoints > 0}
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Match Points:</span>
                                    <Badge color="gray">
                                        +{detail.matchPoints}
                                    </Badge>
                                </div>
                            {/if}

                            {#if detail.bonusPoints > 0}
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Bonus Points:</span>
                                    <Badge color="gray">
                                        +{detail.bonusPoints}
                                    </Badge>
                                </div>
                            {/if}

                            {#if detail.knockoutPoints > 0}
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Knockout Points:</span>
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
                    </Card>
                {/each}
            </div>

            <!-- Summary Footer -->
            <div class="mt-4 border-t border-t-gray-200 pt-4 dark:border-t-gray-700">
                <div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                    <div class="text-center">
                        <div class="text-gray-600 dark:text-gray-400">Total Appearance</div>
                        <div class="font-semibold">
                            {playerData.sortedDetails.reduce(
                                (sum, d) => sum + d.appearancePoints,
                                0
                            )}
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
</div>

<CelebrationOverlay
    bind:celebrating
    teamName={player}
    teamColour="default"
    icon="🥇"
    confettiColours={['#efb100', '#fff085']} />
