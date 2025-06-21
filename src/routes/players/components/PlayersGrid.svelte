<script>
    import PlayersList from './PlayersList.svelte';
    import { settings } from '$lib/stores/settings.js';
    let { players, canModifyList, onremove } = $props();
</script>

<div class="grid grid-cols-2 gap-2">
    <PlayersList
        label={`Players (${$settings.playerLimit} max)`}
        players={players.filter(
            /** @param {string} p
             * @param {number} i */
            (p, i) => i < $settings.playerLimit
        )}
        {canModifyList}
        {onremove} />
    <PlayersList
        label="Waiting list"
        players={players.filter(
            /** @param {string} p
             * @param {number} i */
            (p, i) => i >= $settings.playerLimit
        )}
        {canModifyList}
        {onremove} />
</div>
