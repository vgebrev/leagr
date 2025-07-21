<script>
    import { onMount } from 'svelte';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import PlayerRegistrationForm from './components/PlayerRegistrationForm.svelte';
    import RegistrationAlerts from './components/RegistrationAlerts.svelte';
    import PlayersGrid from './components/PlayersGrid.svelte';

    let { data } = $props();
    let playerName = $state('');

    onMount(async () => {
        await playersService.loadPlayers(data.date);
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
        date={data.date} />
</div>
