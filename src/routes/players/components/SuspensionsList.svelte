<script>
    import { Listgroup, ListgroupItem } from 'flowbite-svelte';

    let { suspendedPlayers = [] } = $props();
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
                <ListgroupItem class="flex flex-col items-start gap-1 p-1 ps-2">
                    <span
                        class="max-w-100 overflow-hidden font-medium text-nowrap overflow-ellipsis whitespace-nowrap">
                        {i + 1}. {player.playerName}
                    </span>
                    <span class="text-xs text-gray-500">
                        {player.statusText}
                    </span>
                </ListgroupItem>
            {/each}
        {/if}
    </Listgroup>
</div>
