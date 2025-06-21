<script>
    import { Label, Input, Button } from 'flowbite-svelte';
    import { CirclePlusSolid } from 'flowbite-svelte-icons';

    let { playerName = $bindable(), rankedPlayers, canModifyList, onadd } = $props();

    /**
     * @param {Event} event
     */
    function handleSubmit(event) {
        event.preventDefault();
        onadd && onadd(playerName.trim());
    }
</script>

<Label for="player-name">Add a player to the list</Label>
<form
    class="flex gap-2"
    onsubmit={handleSubmit}>
    <Input
        bind:value={playerName}
        data={rankedPlayers}
        clearable
        id="player-name"
        name="player-name"
        type="text"
        placeholder="Player Name"
        wrapperClass="w-full"
        required
        disabled={!canModifyList}
        autocomplete="off" />
    <Button
        type="submit"
        disabled={!canModifyList}>
        <CirclePlusSolid class="me-2 h-4 w-4" /> Add
    </Button>
</form>
