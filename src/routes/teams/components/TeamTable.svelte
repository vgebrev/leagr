<script>
    import { capitalize, teamStyles } from '$lib/shared/helpers.js';
    import PlayerActionsDropdown from '$components/PlayerActionsDropdown.svelte';
    import RenamePlayerModal from '$components/RenamePlayerModal.svelte';
    import { settings } from '$lib/client/stores/settings.js';

    let {
        team,
        color = 'default',
        teamName,
        canModifyList = true,
        onremove = null,
        onassign = null,
        onrename = null,
        onPlayerClick = null,
        onTeamClick = null,
        assignablePlayers = [],
        allTeams = {},
        size = 'md',
        showPlayerRankings = false,
        showTeamRatings = true
    } = $props();

    const styles = $derived(teamStyles[color] || teamStyles.default);
    const headerBgClass = $derived(
        styles.header
            .split(' ')
            .filter((cls) => cls.startsWith('bg-') || cls.startsWith('dark:bg-'))
            .join(' ')
    );
    const headerTextClass = $derived(
        styles.header
            .split(' ')
            .filter((cls) => cls.startsWith('text-') || cls.startsWith('dark:text-'))
            .join(' ')
    );
    const sizeStyles = {
        sm: 'text-sm px-2 py-1',
        md: 'text-sm px-2 py-1'
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

    // Apply a gentle gamma spread to stretch the bar display (cosmetic only)
    function applyGammaSpread(value, gamma = 0.45) {
        if (value === null || value === undefined) return null;
        const clamped = Math.min(1, Math.max(0, value));
        return Math.pow(clamped, gamma);
    }

    // Calculate team average attacking rating
    const teamAverageAttacking = $derived.by(() => {
        if (!team) return null;

        let total = 0;
        let count = 0;

        team.forEach((player) => {
            if (player && typeof player === 'object' && player.attackingRating !== null) {
                total += player.attackingRating;
                count++;
            }
        });

        return count > 0 ? total / count : null;
    });

    // Calculate team average control rating
    const teamAverageControl = $derived.by(() => {
        if (!team) return null;

        let total = 0;
        let count = 0;

        team.forEach((player) => {
            if (player && typeof player === 'object' && player.controlRating !== null) {
                total += player.controlRating;
                count++;
            }
        });

        return count > 0 ? total / count : null;
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

    let showRenameModal = $state(false);
    let playerToRename = $state('');

    // Get all players for duplicate checking in the modal
    const allPlayers = $derived.by(() => {
        const players = [];

        // Add all players from all teams
        if (allTeams) {
            Object.values(allTeams).forEach((teamRoster) => {
                teamRoster.forEach((player) => {
                    if (player) {
                        const playerName =
                            typeof player === 'string' ? player : player.name || player;
                        if (!players.includes(playerName)) {
                            players.push(playerName);
                        }
                    }
                });
            });
        }

        // Add assignable players (unassigned/waiting)
        assignablePlayers.forEach((player) => {
            const playerName = typeof player === 'string' ? player : player.name || player;
            if (!players.includes(playerName)) {
                players.push(playerName);
            }
        });

        return players;
    });

    function handleRename(oldName, newName) {
        if (onrename) {
            onrename(oldName, newName);
        }
    }
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
                        {#if onTeamClick && !isPlayerList}
                            <button
                                type="button"
                                onclick={() => onTeamClick?.(teamName)}
                                class="cursor-pointer text-left uppercase hover:underline">
                                {teamName || `${capitalize(color)} Team`}
                            </button>
                        {:else}
                            <div class="text-left uppercase">
                                {teamName || `${capitalize(color)} Team`}
                            </div>
                        {/if}
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
            {#if showTeamRatings && !isPlayerList && (teamAverageAttacking !== null || teamAverageControl !== null)}
                <tr class={`${styles.row}`}>
                    <td class="p-2">
                        <div class="border-b pb-2 ${styles.border}">
                            {#if teamAverageAttacking !== null}
                                <div class="flex items-center gap-2">
                                    <span class={`w-11 text-xs ${headerTextClass}`}>Attack</span>
                                    <div
                                        class="h-2 flex-1 rounded-full bg-gray-200/60 dark:bg-gray-700/60">
                                        <div
                                            class={`h-2 w-full rounded-full transition-all ${headerBgClass}`}
                                            style="width: {(
                                                applyGammaSpread(teamAverageAttacking) * 100
                                            ).toFixed(1)}%">
                                        </div>
                                    </div>
                                    <span
                                        class={`text-right text-xs ${headerTextClass}`}
                                        title={`Raw ${(teamAverageAttacking * 100).toFixed(0)}%`}>
                                        {(applyGammaSpread(teamAverageAttacking) * 100).toFixed(0)}
                                    </span>
                                </div>
                            {/if}
                            {#if teamAverageControl !== null}
                                <div class="flex items-center gap-2">
                                    <span class={`w-11 text-xs ${headerTextClass}`}>Defense</span>
                                    <div
                                        class="h-2 w-full flex-1 rounded-full bg-gray-200/60 dark:bg-gray-700/60">
                                        <div
                                            class={`h-2 rounded-full transition-all ${headerBgClass}`}
                                            style="width: {(
                                                applyGammaSpread(teamAverageControl) * 100
                                            ).toFixed(1)}%">
                                        </div>
                                    </div>
                                    <span
                                        class={`text-right text-xs ${headerTextClass}`}
                                        title={`Raw ${(teamAverageControl * 100).toFixed(0)}%`}>
                                        {(applyGammaSpread(teamAverageControl) * 100).toFixed(0)}
                                    </span>
                                </div>
                            {/if}
                        </div>
                    </td>
                </tr>
            {/if}
            {#each team as player, i (i)}
                <tr class={`${styles.row}`}>
                    <td class="m-0 {sizeStyles[size]}"
                        ><div class="flex items-center justify-between">
                            <div class="min-w-0 flex-1">
                                {#if player}
                                    {@const playerName =
                                        typeof player === 'string' ? player : player.name || player}
                                    <button
                                        onclick={() => onPlayerClick?.(playerName)}
                                        class="cursor-pointer truncate hover:underline">
                                        {playerName}
                                    </button>
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
                                            type: 'rename',
                                            label: 'Rename',
                                            onclick: () => {
                                                playerToRename = playerName;
                                                showRenameModal = true;
                                            }
                                        },
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
                                            type: 'rename',
                                            label: 'Rename',
                                            onclick: () => {
                                                playerToRename = playerName;
                                                showRenameModal = true;
                                            }
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

<RenamePlayerModal
    currentName={playerToRename}
    {allPlayers}
    bind:open={showRenameModal}
    onrename={handleRename} />
