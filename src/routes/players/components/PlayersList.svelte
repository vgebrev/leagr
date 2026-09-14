<script>
    import { Listgroup, ListgroupItem } from 'flowbite-svelte';
    import PlayerActionsDropdown from '$components/PlayerActionsDropdown.svelte';
    import RenamePlayerModal from '$components/RenamePlayerModal.svelte';

    /**
     * @type {{
     *   label: string,
     *   players: string[],
     *   allPlayers?: string[],
     *   canModifyList?: boolean,
     *   onremove: (playerName: string, list?: string) => Promise<void> | void,
     *   onmove?: (playerName: string, from: string, to: string) => Promise<void> | void,
     *   onrename?: (oldName: string, newName: string) => Promise<void> | void,
     *   sourceList?: string,
     *   destinationList?: string,
     *   moveLabel?: string,
     *   canMoveToOtherList?: (from: string, to: string) => boolean,
     *   onPlayerClick?: (playerName: string) => void,
     *   date?: string | null
     * }}
     */
    /**
     * Build one dropdown action. A bare literal widens `type` to string, and a cast inside
     * {@const} is not something the Svelte ESLint parser accepts.
     * @param {PlayerAction['type']} type
     * @param {string} label
     * @param {() => void | Promise<void>} onclick
     * @param {boolean} [disabled]
     * @returns {PlayerAction}
     */
    const action = (type, label, onclick, disabled) => ({
        type,
        label,
        onclick: () => void onclick(),
        disabled
    });

    let {
        label,
        players,
        allPlayers,
        canModifyList,
        onremove,
        onmove,
        onrename,
        sourceList,
        destinationList,
        moveLabel,
        canMoveToOtherList,
        onPlayerClick,
        // eslint-disable-next-line no-unused-vars -- accepted so the grid can pass it through
        date = null
    } = $props();

    import { getLeagueId } from '$lib/client/services/api-client.svelte.js';
    import { getStoredAdminCode } from '$lib/client/services/auth.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    const leagueId = $derived(getLeagueId());
    const isAdmin = $derived(Boolean(getStoredAdminCode(leagueId)));

    let showRenameModal = $state(false);
    let playerToRename = $state('');

    /**
     * @param {string} oldName
     * @param {string} newName
     */
    function handleRename(oldName, newName) {
        if (onrename) {
            onrename(oldName, newName);
        }
    }
</script>

<div class="flex flex-col gap-2">
    <span class="block text-sm font-medium text-gray-700 rtl:text-right dark:text-gray-200"
        >{label}</span>
    <Listgroup class="glass w-full gap-0 dark:text-gray-300">
        {#each players as player, i (i)}
            <ListgroupItem class="flex gap-2 p-1 ps-2">
                <button
                    onclick={() => onPlayerClick?.(player)}
                    class="max-w-100 cursor-pointer overflow-hidden text-nowrap overflow-ellipsis whitespace-nowrap hover:underline"
                    >{i + 1}. {player}</button>
                {#if onremove}
                    {@const actions = [
                        ...(onmove && sourceList && destinationList
                            ? [
                                  action(
                                      sourceList === 'available'
                                          ? 'move-to-waiting'
                                          : 'move-to-active',
                                      moveLabel || 'Move player',
                                      () => onmove(player, sourceList, destinationList),
                                      canMoveToOtherList
                                          ? !canMoveToOtherList(sourceList, destinationList)
                                          : false
                                  )
                              ]
                            : []),
                        action('rename', 'Rename', () => {
                            playerToRename = player;
                            showRenameModal = true;
                        }),
                        action('remove', 'Remove', () => onremove(player))
                    ]}
                    <PlayerActionsDropdown
                        {actions}
                        canModifyList={Boolean(canModifyList) &&
                            (isAdmin || playersService.ownedByMe.includes(player))} />
                {/if}
            </ListgroupItem>
        {/each}
    </Listgroup>
</div>

<RenamePlayerModal
    currentName={playerToRename}
    {allPlayers}
    bind:open={showRenameModal}
    onrename={handleRename} />
