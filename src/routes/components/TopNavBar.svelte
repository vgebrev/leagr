<script>
    import { Navbar, NavBrand, Spinner } from 'flowbite-svelte';
    import { isLoading } from '$lib/client/stores/loading.js';
    import { resolve } from '$app/paths';
    import LeagueInfo from '$components/LeagueInfo.svelte';
    import NavMenu from './NavMenu.svelte';

    let { date, leagueInfo } = $props();
</script>

<Navbar
    fluid
    class="z-10 shrink-0 px-0 sm:px-0"
    navContainerClass="app-container px-2">
    <NavBrand
        href={resolve(`/?date=${date}`)}
        class="min-w-0 flex-1">
        <LeagueInfo {leagueInfo} />
    </NavBrand>
    <div class="flex shrink-0 items-center gap-2">
        {#if $isLoading}<Spinner size="6" />{/if}
        <NavMenu
            {date}
            {leagueInfo} />
    </div>
</Navbar>
