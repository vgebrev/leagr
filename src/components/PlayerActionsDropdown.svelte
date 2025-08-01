<script>
    import { Button, Dropdown, DropdownItem } from 'flowbite-svelte';
    import {
        DotsVerticalOutline,
        TrashBinOutline,
        ClockOutline,
        ThumbsUpOutline,
        ArrowLeftOutline
    } from 'flowbite-svelte-icons';

    /**
     * @typedef {Object} PlayerAction
     * @property {'remove'|'move-to-waiting'|'move-to-active'|'assign'} type - The action type that determines the icon
     * @property {string} label - The display text for the action
     * @property {() => void} onclick - The function to call when the action is clicked
     * @property {boolean} [disabled] - Whether the action is disabled (optional)
     */

    /**
     * @type {{
     *   actions: PlayerAction[],
     *   canModifyList: boolean,
     *   styleClass: string
     * }}
     */
    let {
        actions = [], // Array of action objects
        canModifyList = true, // Whether the dropdown should be enabled
        styleClass = '' // Additional CSS classes for the button
    } = $props();

    // Internal icon mapping for action types
    const iconMap = {
        remove: TrashBinOutline,
        'move-to-waiting': ClockOutline,
        'move-to-active': ThumbsUpOutline,
        assign: ArrowLeftOutline
    };

    let isOpen = $state(false);
</script>

<Button
    size="sm"
    class="ms-auto p-0 {styleClass}"
    outline={true}
    color="alternative"
    disabled={!canModifyList}
    onclick={() => (isOpen = !isOpen)}>
    <DotsVerticalOutline class="h-4 w-4" />
</Button>

<Dropdown
    simple
    {isOpen}>
    {#each actions as action, i (i)}
        {@const Icon = iconMap[action.type]}
        <DropdownItem
            classes={{ anchor: 'w-full font-normal' }}
            onclick={action.onclick}
            disabled={action.disabled}>
            <span class="flex items-center">
                {#if Icon}<Icon class="me-2 h-4 w-4" />{/if}
                {action.label}
            </span>
        </DropdownItem>
    {/each}
</Dropdown>
