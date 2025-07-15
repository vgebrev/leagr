<script>
    import { AdjustmentsHorizontalSolid } from 'flowbite-svelte-icons';
    import { DarkMode, Navbar, NavBrand, Spinner } from 'flowbite-svelte';
    import { isLoading } from '$lib/client/stores/loading.js';
    import LeagueInfo from '../../components/LeagueInfo.svelte';

    let { date, leagueInfo } = $props();
</script>

<Navbar class="z-10 shrink-0">
    <NavBrand href="/?date={date}">
        <LeagueInfo {leagueInfo} />
    </NavBrand>
    <div class="ml-auto flex items-center gap-2">
        {#if $isLoading}<Spinner size="6" />{/if}
        {#if leagueInfo}
            <a
                class="cursor-default rounded-lg p-2.5 whitespace-normal text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 focus:outline-hidden sm:inline-block dark:text-gray-400 dark:hover:bg-gray-700"
                href={`/settings?date=${date}`}><AdjustmentsHorizontalSolid /></a>
        {/if}
        <DarkMode color="alternative" />
    </div>
</Navbar>
