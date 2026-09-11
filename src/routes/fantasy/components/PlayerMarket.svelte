<script>
    import {
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell
    } from 'flowbite-svelte';
    import { CheckOutline, PlusOutline } from 'flowbite-svelte-icons';
    import Avatar from '$components/avatars/Avatar.svelte';

    /**
     * The week's priced pool. Rows are the only way into a squad, so each one carries its
     * own reason for being unavailable rather than silently doing nothing when clicked.
     * @type {{
     *   market?: Array<Record<string, any>>,
     *   picks?: string[],
     *   remaining?: number,
     *   squadFull?: boolean,
     *   readOnly?: boolean,
     *   onpick?: (playerName: string) => void
     * }}
     */
    let {
        market = [],
        picks = [],
        remaining = 0,
        squadFull = false,
        readOnly = false,
        onpick = undefined
    } = $props();

    let picked = $derived(new Set(picks));

    /** @param {Record<string, any>} entry */
    function isDisabled(entry) {
        if (readOnly) return true;
        if (picked.has(entry.playerName)) return false; // a pick can always be taken back
        return squadFull || entry.price > remaining;
    }
</script>

{#if market.length === 0}
    <p class="py-8 text-center text-gray-500">No priced players for this session yet.</p>
{:else}
    <Table
        classes={{ div: 'w-full overflow-hidden text-xs' }}
        class="w-full table-auto sm:table-fixed dark:text-gray-300"
        shadow>
        <TableHead class="dark:text-gray-300">
            <TableHeadCell class="w-13 px-2.5 py-1.5"
                ><span class="sr-only">Avatar</span></TableHeadCell>
            <TableHeadCell
                class="w-full max-w-0 overflow-hidden px-0 py-1.5 font-bold text-ellipsis text-gray-900 dark:text-white">
                Player
            </TableHeadCell>
            <TableHeadCell class="w-px px-2 py-1.5 text-center sm:w-12">Exp</TableHeadCell>
            <TableHeadCell class="w-px px-2 py-1.5 text-center sm:w-12">Price</TableHeadCell>
            <TableHeadCell class="w-8 px-2 py-1.5"><span class="sr-only">Pick</span></TableHeadCell>
        </TableHead>
        <TableBody>
            {#each market as entry (entry.playerName)}
                {@const disabled = isDisabled(entry)}
                {@const isPicked = picked.has(entry.playerName)}
                <TableBodyRow
                    class="{isPicked ? 'bg-secondary-50 dark:bg-secondary-900/30' : ''} {disabled &&
                    !isPicked
                        ? 'opacity-40'
                        : ''} {disabled ? '' : 'cursor-pointer'}"
                    onclick={() => !disabled && onpick?.(entry.playerName)}>
                    <TableBodyCell class="w-13 px-2.5 py-1.5">
                        <!-- Flex, not the avatar's own inline-block: an inline avatar sits on
                             the text baseline and pads the row with descender space. -->
                        <div class="flex">
                            <Avatar
                                size="sm"
                                avatarUrl={entry.avatar
                                    ? `/api/rankings/${encodeURIComponent(entry.playerName)}/avatar`
                                    : null} />
                        </div>
                    </TableBodyCell>
                    <TableBodyCell class="w-full max-w-0 px-0 py-1.5">
                        <span
                            class="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-gray-900 dark:text-white"
                            class:italic={entry.provisional}>
                            {entry.provisional ? '~' : ''}{entry.playerName}
                        </span>
                        {#if entry.withdrawn}
                            <span class="text-primary-600 block text-[10px]">withdrawn</span>
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-2 py-1.5 text-center text-gray-500 dark:text-gray-400">
                        {entry.expectedPoints === null || entry.expectedPoints === undefined
                            ? '—'
                            : Math.round(entry.expectedPoints * 10) / 10}
                    </TableBodyCell>
                    <TableBodyCell class="px-2 py-1.5 text-center font-bold">
                        {entry.price}
                    </TableBodyCell>
                    <TableBodyCell class="w-8 px-2 py-1.5 text-center">
                        {#if isPicked}
                            <CheckOutline class="text-secondary-600 mx-auto h-4 w-4" />
                        {:else if !disabled}
                            <PlusOutline class="text-primary-600 mx-auto h-4 w-4" />
                        {/if}
                    </TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{/if}
