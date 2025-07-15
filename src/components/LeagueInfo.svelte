<script>
    import LeagueIcon from './LeagueIcon.svelte';

    let { leagueInfo } = $props();

    // Default values for the main league (no subdomain)
    const defaultInfo = {
        name: 'Leagr',
        icon: 'soccer'
    };

    const displayInfo = leagueInfo || defaultInfo;
</script>

<LeagueIcon icon={displayInfo.icon} />
<span class="ml-2 text-xl font-semibold whitespace-nowrap">{displayInfo.name}</span>
