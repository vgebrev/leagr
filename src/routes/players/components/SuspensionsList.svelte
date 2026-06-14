<script>
    import { Listgroup, ListgroupItem, Button } from 'flowbite-svelte';
    import { CheckOutline, CloseOutline, TrashBinOutline } from 'flowbite-svelte-icons';
    import { getLeagueId } from '$lib/client/services/api-client.svelte.js';
    import { getStoredAdminCode } from '$lib/client/services/auth.js';
    import { playersService } from '$lib/client/services/players.svelte.js';

    let { suspendedPlayers = [] } = $props();

    const leagueId = $derived(getLeagueId());
    const isAdmin = $derived(Boolean(getStoredAdminCode(leagueId)));

    let confirmingPlayer = $state(null);

    async function clearPlayer(playerName) {
        confirmingPlayer = null;
        await playersService.clearSuspension(playerName);
    }
</script>

<div class="flex flex-col gap-2">
    <span class="block text-sm font-medium text-gray-700 rtl:text-right dark:text-gray-200"
        >Suspensions</span>
    <Listgroup class="w-full gap-0">
        {#if suspendedPlayers.length === 0}
            <ListgroupItem class="p-1 ps-2 text-sm text-gray-500 italic">
                No suspended players
            </ListgroupItem>
        {:else}
            {#each suspendedPlayers as player, i (i)}
                <ListgroupItem class="flex flex-row items-center justify-between gap-2 p-1 ps-2">
                    <div class="flex min-w-0 flex-col items-start gap-1">
                        <span
                            class="max-w-100 overflow-hidden font-medium text-nowrap text-ellipsis whitespace-nowrap">
                            {i + 1}. {player.playerName}
                        </span>
                        <span class="text-xs text-gray-500">
                            {player.statusText}
                        </span>
                    </div>
                    {#if isAdmin}
                        {#if confirmingPlayer === player.playerName}
                            <div class="flex shrink-0 items-center gap-1">
                                <Button
                                    size="xs"
                                    color="red"
                                    class="p-1.5"
                                    title="Confirm clear"
                                    onclick={() => clearPlayer(player.playerName)}>
                                    <CheckOutline class="h-4 w-4" />
                                </Button>
                                <Button
                                    size="xs"
                                    color="alternative"
                                    class="p-1.5"
                                    title="Cancel"
                                    onclick={() => (confirmingPlayer = null)}>
                                    <CloseOutline class="h-4 w-4" />
                                </Button>
                            </div>
                        {:else}
                            <Button
                                size="xs"
                                color="alternative"
                                class="shrink-0 p-1.5"
                                title="Clear discipline records"
                                onclick={() => (confirmingPlayer = player.playerName)}>
                                <TrashBinOutline class="h-4 w-4" />
                            </Button>
                        {/if}
                    {/if}
                </ListgroupItem>
            {/each}
        {/if}
    </Listgroup>
</div>
