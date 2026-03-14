<script>
    import { teamStyles, teamColours } from '$lib/shared/helpers.js';

    /** @type {{ teamName: string, date: string, size?: number, className?: string, shadow?: boolean }} */
    let { teamName, date, size = 192, className = '', shadow = true } = $props();

    let teamColour = $derived.by(() => {
        const firstWord = teamName.split(' ')[0].toLowerCase();
        return teamColours.includes(firstWord) ? firstWord : 'blue';
    });

    let styles = $derived(teamStyles[teamColour] || teamStyles.blue);
</script>

<div
    class="relative flex items-center justify-center rounded-lg {shadow
        ? 'shadow-sm shadow-gray-950'
        : ''} {styles.row} {className}">
    <img
        src="/api/teams/logos/{encodeURIComponent(teamName)}?date={date}&size={size}"
        alt="{teamName} logo"
        class="object-contain {shadow ? 'drop-shadow-[1px_1px_1px_#030712]' : ''}" />
</div>
