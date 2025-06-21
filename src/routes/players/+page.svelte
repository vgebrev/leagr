<script>
    import { onMount } from 'svelte';
    import { playersService } from '$lib/services/players.svelte.js';
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
     */
    async function addPlayer(name) {
        const success = await playersService.addPlayer(name);
        if (success) {
            playerName = '';
        }
    }

    /**
     * Remove a player from the list.
     * @param {string} name
     */
    async function removePlayer(name) {
        await playersService.removePlayer(name);
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
        players={playersService.players}
        canModifyList={playersService.canModifyList}
        onremove={removePlayer} />
</div>
