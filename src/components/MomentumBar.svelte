<script>
    /**
     * Signed momentum bar: zero at the centre, hot grows right, cold grows left.
     * Segments paint the bar by component share - purely presentational.
     * @type {{ value: number, segments: Array<{share: number, colorClass: string}>, provisional?: boolean }}
     */
    let { value, segments = [], provisional = false } = $props();

    let magnitude = $derived(Math.min(Math.abs(value), 1) * 50);
    let leftPct = $derived(value >= 0 ? 50 : 50 - magnitude);
</script>

<div class="relative h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
    <div
        class="absolute inset-y-0 flex overflow-hidden rounded-sm {provisional ? 'opacity-40' : ''}"
        style="left: {leftPct}%; width: {magnitude}%;">
        {#each segments as segment, i (i)}
            <div
                class="{segment.colorClass} h-full"
                style="width: {segment.share * 100}%">
            </div>
        {/each}
    </div>
    <!-- Centre (neutral) marker -->
    <div class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 dark:bg-gray-500">
    </div>
</div>
