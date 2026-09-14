<script>
    import PlayersList from './PlayersList.svelte';
    import { settings } from '$lib/client/stores/settings.js';
    /**
     * @type {{
     *   availablePlayers: string[],
     *   waitingList: string[],
     *   canModifyList?: boolean,
     *   onremove: (playerName: string, list?: string) => Promise<void> | void,
     *   onmove?: (playerName: string, from: string, to: string) => Promise<void> | void,
     *   onrename?: (oldName: string, newName: string) => Promise<void> | void,
     *   onPlayerClick?: (playerName: string) => void,
     *   date?: string | null
     * }}
     */
    let {
        availablePlayers,
        waitingList,
        canModifyList,
        onremove,
        onmove,
        onrename,
        onPlayerClick,
        date
    } = $props();

    // Get all players for duplicate checking in rename modal
    const allPlayers = $derived([...availablePlayers, ...waitingList]);

    /**
     * Checks if a player can be moved to another list based on the current settings.
     * This function is used to determine if a player can be moved from the waiting list to
     * the available players list, considering the player limit for the day.
     * @param {string} sourceList
     * @param {string} destinationList
     */
    function canMoveToOtherList(sourceList, destinationList) {
        if (sourceList === 'waitingList' && destinationList === 'available') {
            const effectivePlayerLimit =
                (date ? $settings[date]?.playerLimit : null) || $settings.playerLimit;
            return availablePlayers.length < effectivePlayerLimit;
        }
        return true;
    }

    const effectivePlayerLimit = $derived(
        (date ? $settings[date]?.playerLimit : null) || $settings.playerLimit
    );
</script>

<div class="grid grid-cols-2 gap-2">
    <div>
        <PlayersList
            label={`Players (${availablePlayers?.length || 0}/${effectivePlayerLimit})`}
            players={availablePlayers}
            {allPlayers}
            {canModifyList}
            onremove={async (/** @type {string} */ name) => await onremove(name, 'available')}
            {onmove}
            {onrename}
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
            {allPlayers}
            {canModifyList}
            onremove={async (/** @type {string} */ name) => await onremove(name, 'waitingList')}
            {onmove}
            {onrename}
            {onPlayerClick}
            sourceList="waitingList"
            destinationList="available"
            moveLabel="Move to active list"
            {canMoveToOtherList}
            {date} />
    </div>
</div>
