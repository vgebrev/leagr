<script>
    import { Button, Listgroup, ListgroupItem, Dropdown, DropdownItem } from 'flowbite-svelte';
    import {
        DotsVerticalOutline,
        TrashBinOutline,
        ClockOutline,
        ThumbsUpOutline
    } from 'flowbite-svelte-icons';

    let {
        label,
        players,
        canModifyList,
        onremove,
        onmove,
        sourceList,
        destinationList,
        moveLabel,
        canMoveToOtherList
    } = $props();

    let dropdownOpen = $derived(players.map(() => false));
    $effect(() => {
        dropdownOpen = players.map(() => false);
    });
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
                    <Button
                        size="sm"
                        class="ms-auto p-0"
                        type="button"
                        outline={true}
                        color="alternative"
                        onclick={() => {
                            dropdownOpen[i] = !dropdownOpen[i];
                        }}
                        disabled={!canModifyList}><DotsVerticalOutline class="h-4 w-4" /></Button>
                    <Dropdown
                        simple
                        isOpen={dropdownOpen[i]}>
                        <DropdownItem
                            class="w-full font-normal"
                            onclick={async () => {
                                await onremove(player);
                            }}>
                            <span class="flex items-center">
                                <TrashBinOutline class="me-2 h-4 w-4" />
                                Remove
                            </span>
                        </DropdownItem>
                        {#if onmove && sourceList && destinationList}
                            {@const canMove = canMoveToOtherList
                                ? canMoveToOtherList(player, sourceList, destinationList)
                                : true}
                            <DropdownItem
                                class="w-full font-normal"
                                onclick={async () => {
                                    await onmove(player, sourceList, destinationList);
                                }}
                                disabled={!canMove}>
                                <span class="flex items-center">
                                    {#if sourceList === 'available'}
                                        <ClockOutline class="me-2 h-4 w-4" />
                                    {:else}
                                        <ThumbsUpOutline class="me-2 h-4 w-4" />
                                    {/if}
                                    {moveLabel || 'Move player'}
                                    <span class="flex items-center"> </span></span
                                ></DropdownItem>
                        {/if}
                    </Dropdown>
                {/if}
            </ListgroupItem>
        {/each}
    </Listgroup>
</div>
