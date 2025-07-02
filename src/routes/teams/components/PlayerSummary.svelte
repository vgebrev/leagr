<script>
    let { playerSummary } = $props();
</script>

<div class="flex gap-2 text-nowrap">
    <span>Players:</span>
    <span>{playerSummary.available} available.</span>
    <span>{playerSummary.eligible} eligible.</span>
    {#if playerSummary.excess > 0}
        <span>{playerSummary.excess} excess.</span>
    {/if}
    {#if playerSummary.waitingList > 0}
        <span>{playerSummary.waitingList} on waiting list.</span>
    {/if}
</div>
