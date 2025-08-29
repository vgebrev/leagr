<script>
    import { Listgroup, ListgroupItem } from 'flowbite-svelte';
    import PlayerActionsDropdown from '$components/PlayerActionsDropdown.svelte';

    let {
        label,
        players,
        canModifyList,
        onremove,
        onmove,
        sourceList,
        destinationList,
        moveLabel,
        canMoveToOtherList,
        date
    } = $props();

    import { getLeagueId } from '$lib/client/services/api-client.svelte.js';
    import { getStoredAdminCode } from '$lib/client/services/auth.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    const leagueId = $derived(getLeagueId());
    const isAdmin = $derived(Boolean(getStoredAdminCode(leagueId)));
</script>

<div class="flex flex-col gap-2">
    <span class="block text-sm font-medium text-gray-700 rtl:text-right dark:text-gray-200"
        >{label}</span>
    <Listgroup class="w-full gap-0">
        {#each players as player, i (i)}
            <ListgroupItem class="flex gap-2 p-1 ps-2"
                ><span
                    class="max-w-100 overflow-hidden text-nowrap overflow-ellipsis whitespace-nowrap"
                    >{i + 1}. {player}</span
                >{#if onremove}
                    {@const actions = [
                        {
                            type: 'remove',
                            label: 'Remove',
                            onclick: async () => await onremove(player)
                        },
                        ...(onmove && sourceList && destinationList
                            ? [
                                  {
                                      type:
                                          sourceList === 'available'
                                              ? 'move-to-waiting'
                                              : 'move-to-active',
                                      label: moveLabel || 'Move player',
                                      onclick: async () =>
                                          await onmove(player, sourceList, destinationList),
                                      disabled: canMoveToOtherList
                                          ? !canMoveToOtherList(sourceList, destinationList)
                                          : false
                                  }
                              ]
                            : [])
                    ]}
                    <PlayerActionsDropdown
                        {actions}
                        canModifyList={canModifyList && (isAdmin || playersService.ownedByMe.includes(player))} />
                {/if}
            </ListgroupItem>
        {/each}
    </Listgroup>
</div>
