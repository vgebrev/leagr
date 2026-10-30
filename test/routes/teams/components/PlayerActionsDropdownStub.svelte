<script>
    // Renders the menu's items flat, so tests read what each menu offers without driving
    // Flowbite's debounced popover open and closed.
    let { actions = [], canModifyList = true } = $props();
</script>

<ul
    data-testid="player-menu"
    data-enabled={String(canModifyList)}>
    {#each actions as action, i (i)}
        <li data-disabled={String(Boolean(action.disabled))}>
            <button
                type="button"
                onclick={action.onclick}>{action.label}</button>
        </li>
    {/each}
</ul>
