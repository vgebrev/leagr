<script>
    import { Button, Dropdown, DropdownItem } from 'flowbite-svelte';
    import {
        ExclamationCircleSolid,
        ArrowLeftOutline,
        DotsVerticalOutline,
        TrashBinOutline,
        ClockOutline
    } from 'flowbite-svelte-icons';
    import { capitalize, teamColours, teamStyles } from '$lib/shared/helpers.js';

    let {
        team,
        teamIndex = null,
        color = null,
        teamName,
        onremove = null,
        onfillempty = null,
        onfillemptyWithPlayer = null,
        players,
        waitingList = [],
        allWaitingPlayers = [],
        availableTeams = [],
        allTeams = {},
        onassignToTeam = null,
        onremovePlayer = null
    } = $props();

    let teamColour = $derived(color || teamColours[teamIndex % teamColours.length]);
    const styles = $derived(teamStyles[teamColour] || teamStyles.default);

    // Track dropdown states for each player
    let removeDropdownOpen = $derived(team.map(() => false));
    let fillDropdownOpen = $derived(team.map(() => false));
    let assignDropdownOpen = $derived(team.map(() => false));

    $effect(() => {
        removeDropdownOpen = team.map(() => false);
        fillDropdownOpen = team.map(() => false);
        assignDropdownOpen = team.map(() => false);
    });

    // Check if this is an unassigned/waiting list table
    const isPlayerList = $derived(teamName === 'Unassigned Players' || teamName === 'Waiting List');

    // Get teams with empty slots for player assignment
    const teamsWithEmptySlots = $derived.by(() => {
        if (!availableTeams || availableTeams.length === 0) {
            return [];
        }

        return availableTeams.filter((teamName) => {
            const team = allTeams[teamName];
            if (!team) return false;
            return team.some((player) => player === null);
        });
    });

    function handleRemovePlayer(player, action) {
        if (onremove) {
            onremove({ player, teamIndex, action });
        }
    }

    function handleFillEmptySpot(playerIndex, selectedPlayer = null) {
        if (selectedPlayer && onfillemptyWithPlayer) {
            onfillemptyWithPlayer({ playerIndex, teamIndex, selectedPlayer });
        } else if (onfillempty) {
            onfillempty({ playerIndex, teamIndex });
        }
    }

    function handleAssignToTeam(player, teamName) {
        if (onassignToTeam) {
            // Let the server find the first empty slot in the target team
            onassignToTeam({
                playerName: player,
                teamName: teamName
            });
        }
    }

    function handleRemoveFromList(player) {
        if (onremovePlayer) {
            const list = teamName === 'Waiting List' ? 'waitingList' : 'available';
            onremovePlayer(player, list);
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
                    class="p-2">
                    {teamName || `${capitalize(teamColour)} Team`}
                </th>
            </tr>
        </thead>
        <tbody>
            {#each team as player, i (i)}
                <tr class={`${styles.row}`}>
                    <td class="m-0 p-2"
                        ><div class="flex">
                            {#if player && Array.isArray(players) && players.includes(player)}
                                <span>{player}</span>
                            {:else if player && Array.isArray(players) && !players.includes(player)}
                                <span class="flex gap-2 line-through"
                                    ><ExclamationCircleSolid />{player}</span>
                            {:else}
                                <span class="flex gap-2 italic"
                                    ><ExclamationCircleSolid /> Empty</span>
                            {/if}
                            {#if isPlayerList && player}
                                <!-- Dropdown for unassigned/waiting list players -->
                                <Button
                                    size="sm"
                                    class="ms-auto p-0 {styles.buttonClass}"
                                    type="button"
                                    outline={true}
                                    color="alternative"
                                    onclick={() => {
                                        assignDropdownOpen[i] = !assignDropdownOpen[i];
                                    }}><DotsVerticalOutline class="h-4 w-4" /></Button>
                                <Dropdown
                                    simple
                                    isOpen={assignDropdownOpen[i]}>
                                    {#each teamsWithEmptySlots as teamName (teamName)}
                                        <DropdownItem
                                            classes={{ anchor: 'w-full font-normal' }}
                                            onclick={() => handleAssignToTeam(player, teamName)}>
                                            <span class="flex items-center">
                                                <ArrowLeftOutline class="me-2 h-4 w-4" />
                                                {capitalize(teamName)}
                                            </span>
                                        </DropdownItem>
                                    {/each}
                                    <DropdownItem
                                        classes={{ anchor: 'w-full font-normal' }}
                                        onclick={() => handleRemoveFromList(player)}>
                                        <span class="flex items-center">
                                            <TrashBinOutline class="me-2 h-4 w-4" />
                                            Remove
                                        </span>
                                    </DropdownItem>
                                </Dropdown>
                            {:else if onremove && player}
                                <Button
                                    size="sm"
                                    class="ms-auto p-0 {styles.buttonClass}"
                                    type="button"
                                    outline={true}
                                    color="alternative"
                                    onclick={() => {
                                        removeDropdownOpen[i] = !removeDropdownOpen[i];
                                    }}><DotsVerticalOutline class="h-4 w-4" /></Button>
                                <Dropdown
                                    simple
                                    isOpen={removeDropdownOpen[i]}>
                                    <DropdownItem
                                        classes={{ anchor: 'w-full font-normal' }}
                                        onclick={() => handleRemovePlayer(player, 'waitingList')}>
                                        <span class="flex items-center">
                                            <ClockOutline class="me-2 h-4 w-4" />
                                            Move to waiting list
                                        </span>
                                    </DropdownItem>
                                    <DropdownItem
                                        classes={{ anchor: 'w-full font-normal' }}
                                        onclick={() => handleRemovePlayer(player, 'remove')}>
                                        <span class="flex items-center">
                                            <TrashBinOutline class="me-2 h-4 w-4" />
                                            Remove
                                        </span>
                                    </DropdownItem>
                                </Dropdown>
                            {/if}
                            {#if onfillempty && !player}
                                {#if waitingList.length > 0 || allWaitingPlayers.length > 0}
                                    <Button
                                        size="sm"
                                        class="ms-auto p-0 {styles.buttonClass}"
                                        type="button"
                                        outline={true}
                                        color="alternative"
                                        onclick={() => {
                                            fillDropdownOpen[i] = !fillDropdownOpen[i];
                                        }}><DotsVerticalOutline class="h-4 w-4" /></Button>
                                    <Dropdown
                                        simple
                                        isOpen={fillDropdownOpen[i]}>
                                        {#each [...waitingList, ...allWaitingPlayers] as waitingPlayer (waitingPlayer)}
                                            <DropdownItem
                                                classes={{ anchor: 'w-full font-normal' }}
                                                onclick={() =>
                                                    handleFillEmptySpot(i, waitingPlayer)}>
                                                <span class="flex items-center">
                                                    <ArrowLeftOutline class="me-2 h-4 w-4" />
                                                    {waitingPlayer}
                                                </span>
                                            </DropdownItem>
                                        {/each}
                                    </Dropdown>
                                {:else}
                                    <Button
                                        size="sm"
                                        class="ms-auto p-0 {styles.buttonClass} opacity-50"
                                        type="button"
                                        outline={true}
                                        color="alternative"
                                        disabled><ArrowLeftOutline class="h-4 w-4" /></Button>
                                {/if}
                            {/if}
                        </div></td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
