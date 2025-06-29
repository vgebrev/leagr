<script>
    import PlayersList from './PlayersList.svelte';
    import { settings } from '$lib/client/stores/settings.js';
    let { availablePlayers = [], waitingList = [], canModifyList, onremove } = $props();
</script>

<div class="grid grid-cols-2 gap-2">
    <PlayersList
        label={`Players (${$settings.playerLimit} max)`}
        players={availablePlayers}
        {canModifyList}
        onremove={async (name) => await onremove(name, 'available')} />
    <PlayersList
        label="Waiting list"
        players={waitingList}
        {canModifyList}
        onremove={async (name) => await onremove(name, 'waitingList')} />
</div>
