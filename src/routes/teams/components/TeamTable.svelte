<script>
    import { Button, Modal } from 'flowbite-svelte';
    import { fade } from 'svelte/transition';
    import { capitalize, teamStyles } from '#lib/shared/helpers.js';
    import { displayRatingPercent } from '#lib/shared/ratingDisplay.js';
    import PlayerActionsDropdown from '#components/PlayerActionsDropdown.svelte';
    import RenamePlayerModal from '#components/RenamePlayerModal.svelte';
    import { settings } from '#lib/client/stores/settings.js';

    /**
     * @type {{
     *   team: Array<string | null | {name: string, elo?: number | null, attackingRating?: number | null, controlRating?: number | null, avatar?: string | null, isProvisional?: boolean, actualElo?: number | null}>,
     *   color?: TeamColour,
     *   teamName: string,
     *   canModifyList?: boolean,
     *   onremove?: ((playerName: string, action: string, teamName?: string) => void) | null,
     *   onassign?: ((playerName: string, teamName: string) => void) | null,
     *   onAutoAssign?: ((playerName: string) => void) | null,
     *   onrename?: ((oldName: string, newName: string) => void) | null,
     *   onPlayerClick?: ((playerName: string) => void) | null,
     *   onTeamClick?: ((teamName: string) => void) | null,
     *   assignablePlayers?: Array<string | PlayerWithElo>,
     *   allTeams?: EnhancedTeamsData,
     *   size?: 'sm' | 'md',
     *   showPlayerRankings?: boolean,
     *   showTeamRatings?: boolean,
     *   date?: string | null
     * }}
     */
    let {
        team,
        color = 'default',
        teamName,
        canModifyList = true,
        onremove = null,
        onassign = null,
        onAutoAssign = null,
        onrename = null,
        onPlayerClick = null,
        onTeamClick = null,
        assignablePlayers = [],
        allTeams = {},
        size = 'md',
        showPlayerRankings = false,
        showTeamRatings = true,
        date = null
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

    // API endpoint handles fallback to /logos/{colour}.webp when no generated logo exists.
    // Fall back to static asset directly when no date is available.
    const logoSrc = $derived(
        !isPlayerList
            ? date
                ? `/api/teams/logos/${encodeURIComponent(teamName)}?date=${date}&size=512`
                : `/logos/${color}.webp`
            : null
    );

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
                const playerElo = player.elo ?? null;
                if (playerElo !== null) {
                    total += playerElo;
                    assignedPlayerCount++;
                }
            }
        });

        return assignedPlayerCount > 0 ? total / assignedPlayerCount : 0;
    });

    // Same display scale as a player's own profile, so the two never disagree. It is a
    // straight rescale, which leaves the gaps between teams — the thing this table is
    // read for — proportional to the gaps in the underlying ratings.
    const displayPercent = displayRatingPercent;

    // Calculate team average attacking rating
    const teamAverageAttacking = $derived.by(() => {
        if (!team) return null;

        let total = 0;
        let count = 0;

        team.forEach((player) => {
            if (player && typeof player === 'object' && player.attackingRating != null) {
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
            if (player && typeof player === 'object' && player.controlRating != null) {
                total += player.controlRating;
                count++;
            }
        });

        return count > 0 ? total / count : null;
    });

    // Teams below the maximum size, which can take another player
    const teamsWithRoom = $derived.by(() => {
        const maxPlayersPerTeam = $settings.teamGeneration?.maxPlayersPerTeam || 7;
        return Object.keys(allTeams ?? {}).filter(
            (name) => (allTeams[name]?.length ?? Infinity) < maxPlayersPerTeam
        );
    });

    // Teams a player in this table can be moved to (never the team they're already on).
    // Moving out of a team must not leave it below the minimum size.
    const moveTargets = $derived.by(() => {
        if (!isPlayerList) {
            const minPlayersPerTeam = $settings.teamGeneration?.minPlayersPerTeam || 0;
            if (team.length - 1 < minPlayersPerTeam) return [];
        }
        return teamsWithRoom.filter((name) => name !== teamName);
    });

    /**
     * @param {string} player
     * @param {string} action
     */
    function handleRemovePlayer(player, action) {
        if (onremove) {
            onremove(player, action, teamName);
        }
    }

    /**
     * @param {string} playerName
     * @param {string} targetTeamName
     */
    function handleAssignPlayer(playerName, targetTeamName) {
        if (onassign) {
            onassign(playerName, targetTeamName);
        }
    }

    /** @param {string} playerName */
    function handleAutoAssignPlayer(playerName) {
        if (onAutoAssign) {
            onAutoAssign(playerName);
        }
    }

    /** @param {string} player */
    function handleRemoveFromList(player) {
        // For player list tables - use unified remove operation
        if (onremove) {
            onremove(player, 'remove');
        }
    }

    import { getLeagueId } from '#lib/client/services/api-client.svelte.js';
    import { getStoredAdminCode } from '#lib/client/services/auth.js';
    import { playersService } from '#lib/client/services/players.svelte.js';
    const leagueId = $derived(getLeagueId());
    const isAdmin = $derived(Boolean(getStoredAdminCode(leagueId)));

    let showRenameModal = $state(false);
    let playerToRename = $state('');

    // No-shows are open to everyone and hard to undo (a suspended player needs an admin to
    // re-register), so they are confirmed first
    let showNoShowModal = $state(false);
    let playerToNoShow = $state('');

    function confirmNoShow() {
        showNoShowModal = false;
        handleRemovePlayer(playerToNoShow, 'no-show');
    }

    // Get all players for duplicate checking in the modal
    const allPlayers = $derived.by(() => {
        /** @type {string[]} */
        const players = [];

        // Add all players from all teams
        if (allTeams) {
            Object.values(allTeams).forEach((teamRoster) => {
                teamRoster.forEach((player) => {
                    if (player && !players.includes(player.name)) {
                        players.push(player.name);
                    }
                });
            });
        }

        // Add assignable players (unassigned/waiting)
        assignablePlayers.forEach((player) => {
            const playerName = typeof player === 'string' ? player : player.name;
            if (!players.includes(playerName)) {
                players.push(playerName);
            }
        });

        return players;
    });

    /**
     * Build one dropdown action. A bare object literal widens `type` to string, so the
     * actions are built through here instead of being asserted after the fact.
     * @param {PlayerAction['type']} type
     * @param {string} label
     * @param {() => void} onclick
     * @param {boolean} [disabled]
     * @returns {PlayerAction}
     */
    const action = (type, label, onclick, disabled = false) => ({
        type,
        label,
        onclick,
        disabled
    });

    /**
     * Rename, remove and move-to-waiting stay with the player's owner or an admin. Team
     * moves and no-shows are open to all, so players present on the day can shuffle teams.
     * @param {string} playerName
     * @returns {boolean}
     */
    const canManage = (playerName) => isAdmin || playersService.ownedByMe.includes(playerName);

    /**
     * "Move to [team]" items for every other team with space.
     * @param {string} playerName
     * @returns {PlayerAction[]}
     */
    const moveActions = (playerName) =>
        moveTargets.map((targetTeamName) =>
            action('assign', `Move to ${capitalize(targetTeamName)}`, () =>
                handleAssignPlayer(playerName, targetTeamName)
            )
        );

    /**
     * The menu is usable while at least one of its items is.
     * @param {PlayerAction[]} actions
     * @returns {boolean}
     */
    const anyEnabled = (actions) => actions.some((a) => !a.disabled);

    /**
     * @param {string} oldName
     * @param {string} newName
     */
    function handleRename(oldName, newName) {
        if (onrename) {
            onrename(oldName, newName);
        }
    }
</script>

<div
    class={`glass relative w-full self-start overflow-hidden rounded-md ${styles.border}`}
    style={!isPlayerList && logoSrc
        ? `background-color: ${styles.bgHex ?? styles.confetti?.[0] ?? ''}`
        : ''}>
    <table
        class={`w-full text-left text-sm ${styles.text} border-collapse overflow-hidden rounded-md backdrop-blur-lg`}
        style={!isPlayerList && logoSrc
            ? `background-color: transparent; --logo-url: url('${logoSrc}')`
            : ''}>
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
        <tbody class={!isPlayerList && logoSrc ? 'logo-tbody' : ''}>
            {#if showTeamRatings && !isPlayerList && (teamAverageAttacking !== null || teamAverageControl !== null)}
                <tr
                    class={`${styles.row}`}
                    style={logoSrc ? 'background-color: transparent' : ''}>
                    <td class="p-2">
                        <div class="border-b pb-2 ${styles.border}">
                            {#if teamAverageAttacking !== null}
                                <div class="flex items-center gap-2">
                                    <span class={`w-11 text-xs ${headerTextClass}`}>Attack</span>
                                    <div
                                        class="h-2 flex-1 rounded-full bg-gray-200/60 shadow-xs shadow-gray-800 dark:bg-gray-700/60">
                                        <div
                                            class={`h-2 w-full rounded-full transition-all ${headerBgClass}`}
                                            style="width: {(
                                                displayPercent(teamAverageAttacking) ?? 0
                                            ).toFixed(1)}%">
                                        </div>
                                    </div>
                                    <span class={`text-right text-xs ${headerTextClass}`}>
                                        {(displayPercent(teamAverageAttacking) ?? 0).toFixed(0)}
                                    </span>
                                </div>
                            {/if}
                            {#if teamAverageControl !== null}
                                <div class="flex items-center gap-2">
                                    <span class={`w-11 text-xs ${headerTextClass}`}>Defence</span>
                                    <div
                                        class="h-2 w-full flex-1 rounded-full bg-gray-200/60 shadow-xs shadow-gray-800 dark:bg-gray-700/60">
                                        <div
                                            class={`h-2 rounded-full transition-all ${headerBgClass}`}
                                            style="width: {(
                                                displayPercent(teamAverageControl) ?? 0
                                            ).toFixed(1)}%">
                                        </div>
                                    </div>
                                    <span class={`text-right text-xs ${headerTextClass}`}>
                                        {(displayPercent(teamAverageControl) ?? 0).toFixed(0)}
                                    </span>
                                </div>
                            {/if}
                        </div>
                    </td>
                </tr>
            {/if}
            {#each team as player, i (i)}
                <tr
                    class={`${styles.row}`}
                    style={logoSrc ? 'background-color: transparent' : ''}>
                    <td class="m-0 {sizeStyles[size]}"
                        ><div class="flex items-center justify-between">
                            <div class="min-w-0 flex-1">
                                {#if player}
                                    {@const playerName =
                                        typeof player === 'string' ? player : player.name}
                                    <button
                                        onclick={() => onPlayerClick?.(playerName)}
                                        class="cursor-pointer truncate hover:underline">
                                        {playerName}
                                    </button>
                                {:else}
                                    <!-- Only the draw replay passes empty rows: placeholders
                                         its animation fills in as players are drawn -->
                                    <span class="italic opacity-50">Empty</span>
                                {/if}
                            </div>
                            <div class="ml-2 flex shrink-0 items-center gap-2">
                                {#if player && showPlayerRankings && typeof player === 'object'}
                                    {@const playerElo = player.elo}
                                    {#if playerElo != null}
                                        <span
                                            class="text-xs whitespace-nowrap opacity-50"
                                            class:italic={player.isProvisional}
                                            title={player.isProvisional
                                                ? `Provisional (actual: ${player.actualElo ?? playerElo})`
                                                : 'Established rating'}>
                                            {#if player.isProvisional}~{/if}{playerElo}
                                        </span>
                                    {/if}
                                {/if}
                                {#if isPlayerList && player}
                                    <!-- Dropdown for unassigned/waiting list players -->
                                    {@const playerName =
                                        typeof player === 'string' ? player : player.name}
                                    {@const restricted = !canManage(playerName)}
                                    {@const actions = [
                                        ...(onAutoAssign && moveTargets.length > 0
                                            ? [
                                                  action('assign', 'Auto-assign', () =>
                                                      handleAutoAssignPlayer(playerName)
                                                  )
                                              ]
                                            : []),
                                        ...moveActions(playerName),
                                        action(
                                            'rename',
                                            'Rename',
                                            () => {
                                                playerToRename = playerName;
                                                showRenameModal = true;
                                            },
                                            restricted
                                        ),
                                        action(
                                            'remove',
                                            'Remove',
                                            () => handleRemoveFromList(playerName),
                                            restricted
                                        )
                                    ]}
                                    <PlayerActionsDropdown
                                        {actions}
                                        canModifyList={canModifyList && anyEnabled(actions)}
                                        styleClass={styles.buttonClass} />
                                {:else if onremove && player}
                                    {@const playerName =
                                        typeof player === 'string' ? player : player.name}
                                    {@const restricted = !canManage(playerName)}
                                    {@const actions = [
                                        ...(onassign ? moveActions(playerName) : []),
                                        action(
                                            'move-to-waiting',
                                            'Move to waiting list',
                                            () => handleRemovePlayer(playerName, 'waitingList'),
                                            restricted
                                        ),
                                        action(
                                            'rename',
                                            'Rename',
                                            () => {
                                                playerToRename = playerName;
                                                showRenameModal = true;
                                            },
                                            restricted
                                        ),
                                        action(
                                            'remove',
                                            'Remove',
                                            () => handleRemovePlayer(playerName, 'remove'),
                                            restricted
                                        ),
                                        ...(isDisciplineEnabled
                                            ? [
                                                  action('no-show', 'No-show', () => {
                                                      playerToNoShow = playerName;
                                                      showNoShowModal = true;
                                                  })
                                              ]
                                            : [])
                                    ]}
                                    <PlayerActionsDropdown
                                        {actions}
                                        canModifyList={canModifyList && anyEnabled(actions)}
                                        styleClass={styles.buttonClass} />
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

<Modal
    transition={fade}
    bind:open={showNoShowModal}
    title="Mark as no-show?"
    size="xs"
    autoclose={false}
    outsideclose={false}
    classes={{ header: 'p-4 text-md font-semibold', close: 'p-0' }}>
    <p class="text-sm">
        <strong>{playerToNoShow}</strong> will be removed from today's session and a no-show recorded
        against them, which can lead to a suspension. Only an admin can undo this.
    </p>
    <div class="flex gap-2">
        <Button
            class="flex-1"
            onclick={confirmNoShow}>
            Mark no-show
        </Button>
        <Button
            color="alternative"
            class="flex-1"
            onclick={() => (showNoShowModal = false)}>
            Cancel
        </Button>
    </div>
</Modal>

<style>
    tbody.logo-tbody {
        position: relative;
        z-index: 0;
    }
    tbody.logo-tbody::after {
        content: '';
        position: absolute;
        /* 85% of both dimensions, so a wide/short tbody can't crop the logo */
        inset: 7.5%;
        max-width: 420px;
        max-height: 420px;
        margin: auto;
        background-image: var(--logo-url);
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 0.15;
        filter: drop-shadow(2px 2px 2px #030712);
        pointer-events: none;
        z-index: -1;
    }
</style>
