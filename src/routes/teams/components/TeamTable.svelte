<script>
    import { capitalize, teamStyles } from '$lib/shared/helpers.js';
    import PlayerActionsDropdown from '$components/PlayerActionsDropdown.svelte';

    let {
        team,
        color = 'default',
        teamName,
        canModifyList = true,
        onremove = null,
        onassign = null,
        assignablePlayers = [],
        allTeams = {},
        size = 'md'
    } = $props();

    const styles = $derived(teamStyles[color] || teamStyles.default);
    const sizeStyles = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm p-2'
    };

    // Check if this is an unassigned/waiting list table
    const isPlayerList = $derived(teamName === 'Unassigned Players' || teamName === 'Waiting List');

    // Get teams with empty slots for player assignment
    const teamsWithEmptySlots = $derived.by(() => {
        if (!allTeams || Object.keys(allTeams).length === 0) {
            return [];
        }

        return Object.keys(allTeams).filter((teamName) => {
            const team = allTeams[teamName];
            if (!team) return false;
            return team.some((player) => player === null);
        });
    });

    function handleRemovePlayer(player, action) {
        if (onremove) {
            onremove(player, action, teamName);
        }
    }

    function handleAssignPlayer(playerName, targetTeamName) {
        if (onassign) {
            onassign(playerName, targetTeamName);
        }
    }

    function handleRemoveFromList(player) {
        // For player list tables - use unified remove operation
        if (onremove) {
            onremove(player, 'remove');
        }
    }
</script>

<div class="relative overflow-hidden rounded-md shadow-md">
    <table
        class={`w-full text-left text-sm rtl:text-right ${styles.text} border-collapse overflow-hidden rounded-md`}>
        <thead class={`text-xs uppercase ${styles.header}`}>
            <tr>
                <th
                    scope="col"
                    class={sizeStyles[size]}>
                    {teamName || `${capitalize(color)} Team`}
                </th>
            </tr>
        </thead>
        <tbody>
            {#each team as player, i (i)}
                <tr class={`${styles.row}`}>
                    <td class="m-0 {sizeStyles[size]}"
                        ><div class="flex">
                            {#if player}
                                <span>{player}</span>
                            {:else}
                                <span class="flex gap-2 italic opacity-50">Empty</span>
                            {/if}
                            {#if isPlayerList && player}
                                <!-- Dropdown for unassigned/waiting list players -->
                                {@const actions = [
                                    ...teamsWithEmptySlots.map((teamName) => ({
                                        type: 'assign',
                                        label: capitalize(teamName),
                                        onclick: () => handleAssignPlayer(player, teamName)
                                    })),
                                    {
                                        type: 'remove',
                                        label: 'Remove',
                                        onclick: () => handleRemoveFromList(player)
                                    }
                                ]}
                                <PlayerActionsDropdown
                                    {actions}
                                    {canModifyList}
                                    styleClass={styles.buttonClass} />
                            {:else if onremove && player}
                                {@const actions = [
                                    {
                                        type: 'move-to-waiting',
                                        label: 'Move to waiting list',
                                        onclick: () => handleRemovePlayer(player, 'waitingList')
                                    },
                                    {
                                        type: 'remove',
                                        label: 'Remove',
                                        onclick: () => handleRemovePlayer(player, 'remove')
                                    },
                                    {
                                        type: 'no-show',
                                        label: 'No-show',
                                        onclick: () => handleRemovePlayer(player, 'no-show')
                                    }
                                ]}
                                <PlayerActionsDropdown
                                    {actions}
                                    {canModifyList}
                                    styleClass={styles.buttonClass} />
                            {/if}
                            {#if onassign && !player}
                                {#if assignablePlayers.length > 0}
                                    {@const actions = [
                                        {
                                            type: 'assign',
                                            label: 'Auto-assign first available',
                                            onclick: () => handleAssignPlayer(null, teamName)
                                        },
                                        ...assignablePlayers.map((waitingPlayer) => ({
                                            type: 'assign',
                                            label: waitingPlayer,
                                            onclick: () =>
                                                handleAssignPlayer(waitingPlayer, teamName)
                                        }))
                                    ]}
                                    <PlayerActionsDropdown
                                        {actions}
                                        {canModifyList}
                                        styleClass={styles.buttonClass} />
                                {:else}
                                    <PlayerActionsDropdown
                                        actions={[]}
                                        canModifyList={false}
                                        styleClass={styles.buttonClass} />
                                {/if}
                            {/if}
                        </div></td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
