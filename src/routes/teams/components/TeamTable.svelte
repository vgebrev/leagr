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

    // Calculate team average ELO when showPlayerRankings is enabled
    const teamAverageElo = $derived.by(() => {
        if (!showPlayerRankings || !team) return 0;

        let total = 0;
        let assignedPlayerCount = 0;

        team.forEach((player) => {
            if (player && typeof player === 'object') {
                // Use ELO if available, fallback to rankingPoints for legacy data
                const playerElo = player.elo ?? player.rankingPoints ?? null;
                if (playerElo !== null && playerElo !== undefined) {
                    total += playerElo;
                    assignedPlayerCount++;
                }
            }
        });

        return assignedPlayerCount > 0 ? total / assignedPlayerCount : 0;
    });

    // Get teams with available slots for player assignment
    const teamsWithEmptySlots = $derived.by(() => {
        if (!allTeams || Object.keys(allTeams).length === 0) {
            return [];
        }

        const maxPlayersPerTeam = $settings.teamGeneration?.maxPlayersPerTeam || 7;

        return Object.keys(allTeams).filter((teamName) => {
            const team = allTeams[teamName];
            if (!team) return false;

            // Count actual players (non-null entries)
            const currentPlayerCount = team.filter((player) => player !== null).length;

            // Team has space if it has null slots OR is below max capacity
            return team.some((player) => player === null) || currentPlayerCount < maxPlayersPerTeam;
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

    import { getLeagueId } from '$lib/client/services/api-client.svelte.js';
    import { getStoredAdminCode } from '$lib/client/services/auth.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    const leagueId = $derived(getLeagueId());
    const isAdmin = $derived(Boolean(getStoredAdminCode(leagueId)));
</script>

<div class="relative overflow-hidden rounded-md">
    <table
        class={`w-full text-left text-sm ${styles.text} glass border-collapse overflow-hidden rounded-md backdrop-blur-lg`}>
        <thead class={`text-xs uppercase ${styles.header} backdrop-blur-lg`}>
            <tr>
                <th
                    scope="col"
                    class={sizeStyles[size]}>
                    <div class="flex items-center gap-1 overflow-hidden">
                        <div>
                            {teamName || `${capitalize(color)} Team`}
                        </div>
                        {#if showPlayerRankings && teamAverageElo > 0}
                            <div class="ml-auto opacity-50">
                                {teamAverageElo.toFixed(0)}
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
                        ><div class="flex items-center justify-between">
                            <div class="min-w-0 flex-1">
                                {#if player}
                                    <span class="truncate">
                                        {typeof player === 'string'
                                            ? player
                                            : player.name || player}
                                    </span>
                                {:else}
                                    <span class="italic opacity-50">Empty</span>
                                {/if}
                            </div>
                            <div class="ml-2 flex flex-shrink-0 items-center gap-2">
                                {#if player && showPlayerRankings && typeof player === 'object'}
                                    {@const playerElo = player.elo ?? player.rankingPoints}
                                    {#if playerElo !== null && playerElo !== undefined}
                                        <span class="text-xs whitespace-nowrap opacity-50">
                                            {playerElo}
                                        </span>
                                    {/if}
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
                                        canModifyList={canModifyList &&
                                            (isAdmin ||
                                                playersService.ownedByMe.includes(playerName))}
                                        styleClass={styles.buttonClass} />
                                {:else if onremove && player}
                                    {@const playerName =
                                        typeof player === 'string' ? player : player.name || player}
                                    {@const actions = [
                                        {
                                            type: 'move-to-waiting',
                                            label: 'Move to waiting list',
                                            onclick: () =>
                                                handleRemovePlayer(playerName, 'waitingList')
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
                                        canModifyList={canModifyList &&
                                            (isAdmin ||
                                                playersService.ownedByMe.includes(playerName))}
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
                                            ...assignablePlayers.map((waitingPlayer) => {
                                                const playerName =
                                                    typeof waitingPlayer === 'string'
                                                        ? waitingPlayer
                                                        : waitingPlayer.name || waitingPlayer;
                                                return {
                                                    type: 'assign',
                                                    label: playerName,
                                                    onclick: () =>
                                                        handleAssignPlayer(playerName, teamName)
                                                };
                                            })
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
                            </div>
                        </div></td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
