<script>
    import { teamStyles, teamColours, titleCase } from '$lib/shared/helpers.js';

    let { teamName, className, onclick = null } = $props();

    // Extract the colour from the team name (first word)
    let teamColour = $derived.by(() => {
        const firstWord = teamName.split(' ')[0].toLowerCase();
        return teamColours.includes(firstWord) ? firstWord : 'blue'; // default to blue if not found
    });
    let styles = $derived(teamStyles[teamColour] || teamStyles.blue);
    let isClickable = $derived(!!onclick);
</script>

{#if isClickable}
    <button
        type="button"
        {onclick}
        class={`${styles.header} ${className} cursor-pointer overflow-hidden rounded-sm px-1 py-0.5 text-center text-sm font-medium text-nowrap overflow-ellipsis uppercase shadow transition-opacity hover:opacity-80`}
        >{titleCase(teamName)}</button>
{:else}
    <span
        class={`${styles.header} ${className} overflow-hidden rounded-sm px-1 py-0.5 text-center text-sm font-medium text-nowrap overflow-ellipsis uppercase shadow`}
        >{titleCase(teamName)}</span>
{/if}
