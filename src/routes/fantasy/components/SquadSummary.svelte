<script>
    import { Button, Progressbar } from 'flowbite-svelte';
    import { CloseOutline, TagOutline } from 'flowbite-svelte-icons';

    /**
     * The five slots and the budget meter above the market.
     * @type {{
     *   picks?: string[],
     *   squadSize?: number,
     *   budget?: number,
     *   cost?: number,
     *   priceOf?: Record<string, {price: number}>,
     *   readOnly?: boolean,
     *   onremove?: (playerName: string) => void,
     *   onpreview?: () => void
     * }}
     */
    let {
        picks = [],
        squadSize = 5,
        budget = 0,
        cost = 0,
        priceOf = {},
        readOnly = false,
        onremove = undefined,
        onpreview = undefined
    } = $props();

    let remaining = $derived(Math.round((budget - cost) * 2) / 2);
    let overBudget = $derived(remaining < 0);
    let spentPercent = $derived(budget > 0 ? Math.min(100, (cost / budget) * 100) : 0);

    // Empty slots are rendered explicitly so the squad always reads as five decisions,
    // four of which may still be open.
    let slots = $derived([
        ...picks,
        ...Array.from({ length: Math.max(0, squadSize - picks.length) }, () => null)
    ]);
</script>

<div class="glass mb-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
    <div class="mb-1 flex items-baseline justify-between text-sm">
        <span class="font-bold">Squad</span>
        <span class="text-gray-500 dark:text-gray-400">
            <span
                class="font-bold {overBudget
                    ? 'text-primary-600'
                    : 'text-gray-900 dark:text-white'}">
                {cost}
            </span>
            / {budget}
        </span>
    </div>

    <Progressbar
        progress={spentPercent}
        size="h-1.5"
        color={overBudget ? 'primary' : 'secondary'}
        class="mb-2" />

    <div class="mb-2 flex flex-wrap gap-1">
        {#each slots as playerName, index (index)}
            {#if playerName}
                <span
                    class="bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200 flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium">
                    {playerName}
                    <span class="text-secondary-600 dark:text-secondary-400">
                        {priceOf[playerName]?.price ?? '—'}
                    </span>
                    {#if !readOnly}
                        <button
                            type="button"
                            class="cursor-pointer"
                            aria-label="Remove {playerName}"
                            onclick={() => onremove?.(playerName)}>
                            <CloseOutline class="h-3 w-3" />
                        </button>
                    {/if}
                </span>
            {:else}
                <span
                    class="rounded-sm border border-dashed border-gray-300 px-2 py-0.5 text-xs italic opacity-50 dark:border-gray-600">
                    Empty
                </span>
            {/if}
        {/each}
    </div>

    <div class="flex items-center justify-between text-xs">
        <span class="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <TagOutline class="h-4 w-4" />
            {#if overBudget}
                <span class="text-primary-600 font-bold">{Math.abs(remaining)} over budget</span>
            {:else}
                <span>{remaining} left</span>
            {/if}
        </span>
        <Button
            size="xs"
            color="light"
            disabled={picks.length === 0}
            onclick={() => onpreview?.()}>
            Preview
        </Button>
    </div>
</div>
