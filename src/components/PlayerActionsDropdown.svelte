<script>
    import { Button, Dropdown, DropdownItem } from 'flowbite-svelte';
    import {
        DotsVerticalOutline,
        TrashBinOutline,
        ClockOutline,
        ThumbsUpOutline,
        ArrowLeftOutline,
        EditOutline
    } from 'flowbite-svelte-icons';
    import InvisibleFaceIcon from '$components/Icons/InvisibleFaceIcon.svelte';

    /**
     * @typedef {Object} PlayerAction
     * @property {'remove'|'no-show'|'move-to-waiting'|'move-to-active'|'assign'|'rename'} type - The action type that determines the icon
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
        'no-show': InvisibleFaceIcon,
        'move-to-waiting': ClockOutline,
        'move-to-active': ThumbsUpOutline,
        assign: ArrowLeftOutline,
        rename: EditOutline
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
    class="border border-gray-200 dark:border-gray-700 dark:bg-gray-800"
    simple
    {isOpen}>
    {#each actions as action, i (i)}
        {@const Icon = iconMap[action.type]}
        <DropdownItem
            class="w-full font-normal dark:bg-gray-800"
            onclick={async () => {
                try {
                    await action.onclick();
                } catch (error) {
                    console.error('Action failed:', error);
                } finally {
                    isOpen = false;
                }
            }}
            disabled={action.disabled}>
            <span class="flex items-center">
                {#if Icon}<Icon class="me-2 h-4 w-4" />{/if}
                {action.label}
            </span>
        </DropdownItem>
    {/each}
</Dropdown>
