<script>
    import PlayersList from './PlayersList.svelte';
    import { settings } from '$lib/client/stores/settings.js';
    let { availablePlayers, waitingList, canModifyList, onremove, onmove } = $props();

    function canMoveToOtherList(player, sourceList, destinationList) {
        if (sourceList === 'waitingList' && destinationList === 'available') {
            return availablePlayers.length < $settings.playerLimit;
        }
        return true;
    }
</script>

<div class="grid grid-cols-2 gap-2">
    <PlayersList
        label={`Players (${$settings.playerLimit} max)`}
        players={availablePlayers}
        {canModifyList}
        onremove={async (name) => await onremove(name, 'available')}
        {onmove}
        sourceList="available"
        destinationList="waitingList"
        moveLabel="Move to waiting list"
        {canMoveToOtherList} />
    <PlayersList
        label="Waiting list"
        players={waitingList}
        {canModifyList}
        onremove={async (name) => await onremove(name, 'waitingList')}
        {onmove}
        sourceList="waitingList"
        destinationList="available"
        moveLabel="Move to active list"
        {canMoveToOtherList} />
</div>
