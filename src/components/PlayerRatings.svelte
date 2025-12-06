<script>
    import { Tooltip } from 'flowbite-svelte';
    import { scale } from 'svelte/transition';

    const uid = Math.random().toString(36).slice(2, 8);

    let {
        attackingRating = null,
        controlRating = null,
        goalsForPerSession = null,
        goalsAgainstPerSession = null,
        gfRank = null,
        gfCount = null,
        gaRank = null,
        gaCount = null,
        gamma = 0.45,
        tooltipIdPrefix = 'player-rating'
    } = $props();

    function applyGammaSpread(value, spread = gamma, minClamp = 0.1) {
        if (value === null || value === undefined) return null;
        const normalized = Math.min(1, Math.max(0, value));
        // Map [0, 1] to [minClamp, 1]
        const clamped = minClamp + normalized * (1 - minClamp);
        return Math.pow(clamped, spread);
    }

    function formatDisplayPercent(value) {
        const spread = applyGammaSpread(value);
        return spread === null ? null : Math.floor(spread * 100);
    }

    // Calculate overall as the average of the displayed percentages (not raw values)
    // This ensures the overall matches what users see: (Attack% + Defense%) / 2
    const overall = $derived(
        attackingRating !== null && controlRating !== null
            ? (formatDisplayPercent(attackingRating) + formatDisplayPercent(controlRating)) / 2
            : null
    );

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
                        class="relative h-[0.75rem] w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-700">
                        <div
                            class="bg-primary-500 absolute inset-0 rounded-full transition-all"
                            style={`width: ${(applyGammaSpread(attackingRating) * 100).toFixed(1)}%`}>
                        </div>
                    </div>
                    <span class="w-9 text-right text-sm text-gray-500 dark:text-gray-300">
                        {formatDisplayPercent(attackingRating) ?? ''}
                    </span>
                    {#if gfRank !== null && gfCount !== null && goalsForPerSession !== null}
                        <Tooltip
                            class="shadow-lg"
                            triggeredBy={`#${attId}`}
                            transition={scale}>
                            #{gfRank} Team Goals For/Session ({goalsForPerSession.toFixed(2)})
                        </Tooltip>
                    {/if}
                </div>
            {/if}

            {#if controlRating !== null}
                <div
                    class="flex items-center gap-2"
                    id={defId}>
                    <span class="w-14 shrink-0 tracking-wide text-gray-500 dark:text-gray-300"
                        >Defense</span>
                    <div
                        class="relative h-[0.75rem] w-full overflow-hidden rounded-full bg-gray-200/70 dark:bg-gray-700">
                        <div
                            class="bg-primary-500 absolute inset-0 rounded-full transition-all"
                            style={`width: ${(applyGammaSpread(controlRating) * 100).toFixed(1)}%`}>
                        </div>
                    </div>
                    <span class="w-9 text-right text-sm text-gray-500 dark:text-gray-300">
                        {formatDisplayPercent(controlRating) ?? ''}
                    </span>
                    {#if gaRank !== null && gaCount !== null && goalsAgainstPerSession !== null}
                        <Tooltip
                            class="shadow-lg"
                            triggeredBy={`#${defId}`}
                            transition={scale}>
                            #{gaRank} Team Goals Against/Session ({goalsAgainstPerSession.toFixed(
                                2
                            )})
                        </Tooltip>
                    {/if}
                </div>
            {/if}
        </div>

        {#if overall !== null}
            <div
                class="m-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200/80 text-2xl font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-200">
                {Math.floor(overall)}
            </div>
        {/if}
    </div>
{/if}
