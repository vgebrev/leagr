<script>
    import LeagueRegistration from './components/LeagueRegistration.svelte';
    import LeagueHomePage from './components/LeagueHomePage.svelte';

    let { data } = $props();
    let showRegistration = $derived(!data.leagueInfo);
</script>

{#if showRegistration}
    <LeagueRegistration
        leagueId={data.leagueId}
        appUrl={data.appUrl} />
{:else}
    <LeagueHomePage {data} />
{/if}
