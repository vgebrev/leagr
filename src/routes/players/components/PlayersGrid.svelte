<script>
    import PlayersList from './PlayersList.svelte';
    import { settings } from '$lib/client/stores/settings.js';
    let {
        availablePlayers,
        waitingList,
        canModifyList,
        onremove,
        onmove,
        onPlayerClick,
        /** type { string } */
        date
    } = $props();

    /**
     * Checks if a player can be moved to another list based on the current settings.
     * This function is used to determine if a player can be moved from the waiting list to
     * the available players list, considering the player limit for the day.
     * @param {string} sourceList
     * @param {string} destinationList
     */
    function canMoveToOtherList(sourceList, destinationList) {
        if (sourceList === 'waitingList' && destinationList === 'available') {
            const effectivePlayerLimit = $settings[date]?.playerLimit || $settings.playerLimit;
            return availablePlayers.length < effectivePlayerLimit;
        }
        return true;
    }

    const effectivePlayerLimit = $derived($settings[date]?.playerLimit || $settings.playerLimit);
</script>

<div class="grid grid-cols-2 gap-2">
    <div>
        <PlayersList
            label={`Players (${availablePlayers?.length || 0}/${effectivePlayerLimit})`}
            players={availablePlayers}
            {canModifyList}
            onremove={async (name) => await onremove(name, 'available')}
            {onmove}
            {onPlayerClick}
            sourceList="available"
            destinationList="waitingList"
            moveLabel="Move to waiting list"
            {canMoveToOtherList}
            {date} />
    </div>
    <div class="flex flex-col gap-2">
        <PlayersList
            label="Waiting list"
            players={waitingList}
            {canModifyList}
            onremove={async (name) => await onremove(name, 'waitingList')}
            {onmove}
            {onPlayerClick}
            sourceList="waitingList"
            destinationList="available"
            moveLabel="Move to active list"
            {canMoveToOtherList}
            {date} />
    </div>
</div>
