<script>
    import { onMount } from 'svelte';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import PlayerRegistrationForm from './components/PlayerRegistrationForm.svelte';
    import RegistrationAlerts from './components/RegistrationAlerts.svelte';
    import PlayersGrid from './components/PlayersGrid.svelte';
    import SuspensionsModal from './components/SuspensionsModal.svelte';
    import PlayerModal from '$components/PlayerModal.svelte';
    import { Button } from 'flowbite-svelte';
    import { BanOutline } from 'flowbite-svelte-icons';
    import { settings } from '$lib/client/stores/settings.js';

    let { data } = $props();
    let playerName = $state('');
    let showSuspensionsModal = $state(false);
    let showPlayerModal = $state(false);
    let selectedPlayer = $state(null);

    // Check if discipline system is enabled
    const isDisciplineEnabled = $derived($settings.discipline?.enabled !== false);

    function handlePlayerClick(player) {
        selectedPlayer = player;
        showPlayerModal = true;
    }

    onMount(async () => {
        await playersService.loadPlayers(data.date);
        await playersService.loadRankedPlayerNames();
        await playersService.loadSuspensions();
    });

    /**
     * Add a player to the list.
     * @param {string} name
     * @param {string} [list='available'] - The list to add the player to, either 'available' or 'waitingList'.
     */
    async function addPlayer(name, list = 'available') {
        const success = await playersService.addPlayer(name, list);
        if (success) {
            playerName = '';
        }
    }

    /**
     * Remove a player from the list.
     * @param {string} name
     * @param {string} [list='available'] - The list to remove the player from, either 'available' or 'waitingList'.
     */
    async function removePlayer(name, list = 'available') {
        await playersService.removePlayer(name, list);
    }

    /**
     * Move a player from one list to another.
     * @param {string} name
     * @param {string} fromList - The source list ('available' or 'waitingList')
     * @param {string} toList - The destination list ('available' or 'waitingList')
     */
    async function movePlayer(name, fromList, toList) {
        await playersService.movePlayer(name, fromList, toList);
    }
</script>

<div class="flex flex-col gap-2">
    <div class="flex flex-col gap-2">
        <PlayerRegistrationForm
            bind:playerName
            rankedPlayers={playersService.rankedPlayers}
            canModifyList={playersService.canModifyList}
            onadd={addPlayer} />

        <RegistrationAlerts
            registrationOpenDate={playersService.registrationOpenDate}
            registrationCloseDate={playersService.registrationCloseDate} />

        <PlayersGrid
            availablePlayers={playersService.players}
            waitingList={playersService.waitingList}
            canModifyList={playersService.canModifyList}
            onremove={removePlayer}
            onmove={movePlayer}
            onPlayerClick={handlePlayerClick}
            date={data.date} />
    </div>

    {#if isDisciplineEnabled && playersService.suspendedPlayers && playersService.suspendedPlayers.length > 0}
        <div class="mt-auto">
            <Button
                class="w-full"
                color="alternative"
                size="sm"
                onclick={() => (showSuspensionsModal = true)}>
                <BanOutline class="me-2 h-6 w-6 shrink-0" />
                Suspensions
            </Button>
        </div>
    {/if}
</div>

<SuspensionsModal
    suspendedPlayers={playersService.suspendedPlayers}
    bind:open={showSuspensionsModal} />

<PlayerModal
    bind:playerName={selectedPlayer}
    bind:open={showPlayerModal}
    date={data.date} />
