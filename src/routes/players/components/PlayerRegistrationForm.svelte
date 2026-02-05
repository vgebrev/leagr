<script>
    import { Label, Input, Button, Dropdown, DropdownItem } from 'flowbite-svelte';
    import { CirclePlusSolid, ChevronDownOutline, ClockOutline } from 'flowbite-svelte-icons';

    let { playerName = $bindable(), rankedPlayers, canModifyList, onadd } = $props();

    let dropdownOpen = $state(false);
    /** @type {HTMLInputElement | undefined} */
    let input = $state();

    /**
     * @param {Event} event
     */
    function handleSubmit(event) {
        event.preventDefault();
        onadd && onadd(playerName.trim(), 'available');
    }

    /**
     * Add player to the waiting list explicitly
     */
    function addToWaitingList() {
        dropdownOpen = false;
        if (!input.checkValidity()) {
            input.reportValidity();
            input.focus();
            return;
        }
        onadd && onadd(playerName.trim(), 'waitingList');
    }
</script>

<Label for="player-name">Add a player to the list</Label>
<form
    class="flex gap-2"
    onsubmit={handleSubmit}>
    <Input
        bind:elementRef={input}
        bind:value={playerName}
        data={rankedPlayers}
        clearable
        id="player-name"
        name="player-name"
        type="text"
        placeholder="Player Name"
        classes={{ wrapper: 'w-full', combo: 'w-full dark:shadow-gray-900 shadow-md' }}
        class="!bg-gray-50 dark:!bg-gray-800"
        required
        disabled={!canModifyList}
        autocomplete="off" />

    <div class="flex">
        <Button
            type="submit"
            disabled={!canModifyList}
            class="rounded-r-none border-r-0">
            <CirclePlusSolid class="me-2 h-4 w-4" /> Add
        </Button>

        <Button
            type="button"
            disabled={!canModifyList}
            class="rounded-l-none border-l border-gray-300 px-2 dark:border-gray-600"
            onclick={() => (dropdownOpen = !dropdownOpen)}>
            <ChevronDownOutline class="h-4 w-4" />
        </Button>

        <Dropdown
            class="border border-gray-200 !bg-gray-50 dark:border-gray-700 dark:!bg-gray-800"
            bind:isOpen={dropdownOpen}
            simple>
            <DropdownItem onclick={addToWaitingList}>
                <span class="flex items-center">
                    <ClockOutline class="me-2 h-4 w-4" />
                    Waiting list
                </span>
            </DropdownItem>
        </Dropdown>
    </div>
</form>
