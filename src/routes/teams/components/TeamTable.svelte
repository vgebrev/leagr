<script>
    import { Button, Dropdown, DropdownItem } from 'flowbite-svelte';
    import {
        ExclamationCircleSolid,
        ArrowLeftOutline,
        DotsVerticalOutline,
        TrashBinOutline,
        ClockOutline
    } from 'flowbite-svelte-icons';
    import { capitalize, teamStyles } from '$lib/shared/helpers.js';

    let {
        team,
        color = 'default',
        teamName,
        canModifyList = true,
        onremove = null,
        onassign = null,
        assignablePlayers = [],
        allTeams = {}
    } = $props();

    const styles = $derived(teamStyles[color] || teamStyles.default);

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
                    class="p-2">
                    {teamName || `${capitalize(color)} Team`}
                </th>
            </tr>
        </thead>
        <tbody>
            {#each team as player, i (i)}
                <tr class={`${styles.row}`}>
                    <td class="m-0 p-2"
                        ><div class="flex">
                            {#if player}
                                <span>{player}</span>
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
                                    disabled={!canModifyList}
                                    onclick={() => {
                                        assignDropdownOpen[i] = !assignDropdownOpen[i];
                                    }}><DotsVerticalOutline class="h-4 w-4" /></Button>
                                <Dropdown
                                    simple
                                    isOpen={assignDropdownOpen[i]}>
                                    {#each teamsWithEmptySlots as teamName (teamName)}
                                        <DropdownItem
                                            classes={{ anchor: 'w-full font-normal' }}
                                            onclick={() => handleAssignPlayer(player, teamName)}>
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
                                    disabled={!canModifyList}
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
                            {#if onassign && !player}
                                {#if assignablePlayers.length > 0}
                                    <Button
                                        size="sm"
                                        class="ms-auto p-0 {styles.buttonClass}"
                                        type="button"
                                        outline={true}
                                        color="alternative"
                                        disabled={!canModifyList}
                                        onclick={() => {
                                            fillDropdownOpen[i] = !fillDropdownOpen[i];
                                        }}><DotsVerticalOutline class="h-4 w-4" /></Button>
                                    <Dropdown
                                        simple
                                        isOpen={fillDropdownOpen[i]}>
                                        <DropdownItem
                                            classes={{ anchor: 'w-full font-normal' }}
                                            onclick={() => handleAssignPlayer(null, teamName)}>
                                            <span class="flex items-center">
                                                <ArrowLeftOutline class="me-2 h-4 w-4" />
                                                Auto-assign first available
                                            </span>
                                        </DropdownItem>
                                        {#each assignablePlayers as waitingPlayer (waitingPlayer)}
                                            <DropdownItem
                                                classes={{ anchor: 'w-full font-normal' }}
                                                onclick={() =>
                                                    handleAssignPlayer(waitingPlayer, teamName)}>
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
