<script>
    import { Tooltip } from 'flowbite-svelte';
    import { scale } from 'svelte/transition';
    import LeagueIcon from './LeagueIcon.svelte';

    let { leagueInfo } = $props();

    // Default values for the main league (no subdomain)
    const defaultInfo = {
        name: 'Leagr',
        icon: 'soccer'
    };

    const displayInfo = leagueInfo || defaultInfo;
</script>

<div class="flex min-w-0 items-center">
    <div class="shrink-0">
        <LeagueIcon icon={displayInfo.icon} />
    </div>
    <span
        class="ml-2 truncate text-xl font-semibold"
        id="league-name">{displayInfo.name}</span>
    <Tooltip
        triggeredBy="#league-name"
        transition={scale}>{displayInfo.name}</Tooltip>
</div>
