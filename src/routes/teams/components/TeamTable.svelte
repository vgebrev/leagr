<script>
    import { capitalize, teamStyles } from '$lib/shared/helpers.js';
    import PlayerActionsDropdown from '$components/PlayerActionsDropdown.svelte';
    import { settings } from '$lib/client/stores/settings.js';

    let {
        team,
        color = 'default',
        teamName,
        canModifyList = true,
        onremove = null,
        onassign = null,
        assignablePlayers = [],
        allTeams = {},
        size = 'md',
        showPlayerRankings = false
    } = $props();

    const styles = $derived(teamStyles[color] || teamStyles.default);
    const sizeStyles = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm p-2'
    };

    // Check if this is an unassigned/waiting list table
    const isPlayerList = $derived(teamName === 'Unassigned Players' || teamName === 'Waiting List');

    // Check if discipline system is enabled
    const isDisciplineEnabled = $derived($settings.discipline?.enabled !== false);

    // Calculate team average ranking points when showPlayerRankings is enabled
    const teamAverageRankingPoints = $derived.by(() => {
        if (!showPlayerRankings || !team) return 0;

        let total = 0;
        let assignedPlayerCount = 0;

        team.forEach((player) => {
            if (player && player.rankingPoints !== null && player.rankingPoints !== undefined) {
                total += player.rankingPoints;
                assignedPlayerCount++;
            }
        });

        return assignedPlayerCount > 0 ? total / assignedPlayerCount : 0;
    });

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
        class={`w-full text-left text-sm ${styles.text} border-collapse overflow-hidden rounded-md`}>
        <thead class={`text-xs uppercase ${styles.header}`}>
            <tr>
                <th
                    scope="col"
                    class={sizeStyles[size]}>
                    <div class="flex items-center gap-1 overflow-hidden">
                        <div>
                            {teamName || `${capitalize(color)} Team`}
                        </div>
                        {#if showPlayerRankings && teamAverageRankingPoints > 0}
                            <div class="ml-auto opacity-50">
                                {teamAverageRankingPoints.toFixed(1)}
                            </div>
                        {/if}
                    </div>
                </th>
            </tr>
        </thead>
        <tbody>
            {#each team as player, i (i)}
                <tr class={`${styles.row}`}>
                    <td class="m-0 {sizeStyles[size]}"
                        ><div class="flex">
                            {#if player}
                                {#if showPlayerRankings && player.name}
                                    <!-- Enhanced player display with rankings -->
                                    <span>
                                        {player.name}
                                    </span>
                                    {#if player.rankingPoints !== null}<span
                                            class="ms-auto opacity-50">{player.rankingPoints}</span
                                        >{/if}
                                {:else}
                                    <!-- Standard player display (backwards compatibility) -->
                                    <span
                                        >{typeof player === 'string'
                                            ? player
                                            : player.name || player}</span>
                                {/if}
                            {:else}
                                <span class="flex gap-2 italic opacity-50">Empty</span>
                            {/if}
                            {#if isPlayerList && player}
                                <!-- Dropdown for unassigned/waiting list players -->
                                {@const playerName =
                                    typeof player === 'string' ? player : player.name || player}
                                {@const actions = [
                                    ...teamsWithEmptySlots.map((teamName) => ({
                                        type: 'assign',
                                        label: capitalize(teamName),
                                        onclick: () => handleAssignPlayer(playerName, teamName)
                                    })),
                                    {
                                        type: 'remove',
                                        label: 'Remove',
                                        onclick: () => handleRemoveFromList(playerName)
                                    }
                                ]}
                                <PlayerActionsDropdown
                                    {actions}
                                    {canModifyList}
                                    styleClass={styles.buttonClass} />
                            {:else if onremove && player}
                                {@const playerName =
                                    typeof player === 'string' ? player : player.name || player}
                                {@const actions = [
                                    {
                                        type: 'move-to-waiting',
                                        label: 'Move to waiting list',
                                        onclick: () => handleRemovePlayer(playerName, 'waitingList')
                                    },
                                    {
                                        type: 'remove',
                                        label: 'Remove',
                                        onclick: () => handleRemovePlayer(playerName, 'remove')
                                    },
                                    ...(isDisciplineEnabled
                                        ? [
                                              {
                                                  type: 'no-show',
                                                  label: 'No-show',
                                                  onclick: () =>
                                                      handleRemovePlayer(playerName, 'no-show')
                                              }
                                          ]
                                        : [])
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
