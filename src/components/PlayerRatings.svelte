<script>
    import { Tooltip } from 'flowbite-svelte';
    import { scale } from 'svelte/transition';
    import { displayOverall, displayRatingRounded } from '$lib/shared/ratingDisplay.js';

    const uid = Math.random().toString(36).slice(2, 8);

    let {
        attackingRating = null,
        controlRating = null,
        goalsNorm = null,
        offActionsNorm = null,
        teamGFNorm = null,
        saveActionsNorm = null,
        defActionsNorm = null,
        teamGANorm = null,
        tooltipIdPrefix = 'player-rating'
    } = $props();

    // Bars, the overall badge and the component tooltip all read the same scale, so the
    // components a rating is built from average to the rating shown next to them.
    const pct = displayRatingRounded;

    // Overall blends the two displayed percentages, leaning toward the player's stronger
    // side so a specialist is not marked down for the half of the game they don't play.
    const overall = $derived(displayOverall(attackingRating, controlRating));

    const baseId = $derived(
        `${(tooltipIdPrefix || 'player-rating').replace(/[^a-zA-Z0-9_-]/g, '-')}-${uid}`
    );
    const attId = $derived(`${baseId}-att`);
    const defId = $derived(`${baseId}-def`);
</script>

{#if attackingRating !== null || controlRating !== null}
    <div class="flex items-center gap-3">
        <div class="flex-1 text-sm">
            {#if attackingRating !== null}
                <div
                    class="mb-1 flex items-center gap-2"
                    id={attId}>
                    <span class="w-14 shrink-0 tracking-wide text-gray-500 dark:text-gray-300"
                        >Attack</span>
                    <div
                        class="relative h-3 w-full overflow-hidden rounded-full bg-gray-200/70 shadow-sm shadow-gray-800 dark:bg-gray-700 dark:shadow-gray-950">
                        <div
                            class="bg-primary-500 absolute inset-0 rounded-full transition-all"
                            style={`width: ${pct(attackingRating)}%`}>
                        </div>
                    </div>
                    <span class="w-9 text-right text-sm text-gray-500 dark:text-gray-300">
                        {pct(attackingRating) ?? ''}
                    </span>
                    {#if goalsNorm !== null || offActionsNorm !== null || teamGFNorm !== null}
                        <Tooltip
                            class="shadow-lg"
                            triggeredBy={`#${attId}`}
                            transition={scale}>
                            Goals {pct(goalsNorm)}% · Offensive {pct(offActionsNorm)}% · Team GF {pct(
                                teamGFNorm
                            )}%
                        </Tooltip>
                    {/if}
                </div>
            {/if}

            {#if controlRating !== null}
                <div
                    class="flex items-center gap-2"
                    id={defId}>
                    <span class="w-14 shrink-0 tracking-wide text-gray-500 dark:text-gray-300"
                        >Defence</span>
                    <div
                        class="relative h-3 w-full overflow-hidden rounded-full bg-gray-200/70 shadow-sm shadow-gray-800 dark:bg-gray-700 dark:shadow-gray-950">
                        <div
                            class="bg-primary-500 absolute inset-0 rounded-full transition-all"
                            style={`width: ${pct(controlRating)}%`}>
                        </div>
                    </div>
                    <span class="w-9 text-right text-sm text-gray-500 dark:text-gray-300">
                        {pct(controlRating) ?? ''}
                    </span>
                    {#if saveActionsNorm !== null || defActionsNorm !== null || teamGANorm !== null}
                        <Tooltip
                            class="shadow-lg"
                            triggeredBy={`#${defId}`}
                            transition={scale}>
                            Saves {pct(saveActionsNorm)}% · Defensive {pct(defActionsNorm)}% · Team
                            GA {pct(teamGANorm)}%
                        </Tooltip>
                    {/if}
                </div>
            {/if}
        </div>

        {#if overall !== null}
            <div
                class="m-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200/80 text-2xl font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-200">
                {overall}
            </div>
        {/if}
    </div>
{/if}
