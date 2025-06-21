<script>
    import { AdjustmentsHorizontalSolid } from 'flowbite-svelte-icons';
    import { DarkMode, Navbar, NavBrand, Spinner } from 'flowbite-svelte';
    import { isLoading } from '$lib/stores/loading.js';

    let { date } = $props();
</script>

<Navbar class="z-10 shrink-0">
    <NavBrand href="/?date={date}">
        <svg
            class="h-5 w-5"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            ><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path
                d="M416 398.9c58.5-41.1 96-104.1 96-174.9C512 100.3 397.4 0 256 0S0 100.3 0 224c0 70.7 37.5 133.8 96 174.9c0 .4 0 .7 0 1.1l0 64c0 26.5 21.5 48 48 48l48 0 0-48c0-8.8 7.2-16 16-16s16 7.2 16 16l0 48 64 0 0-48c0-8.8 7.2-16 16-16s16 7.2 16 16l0 48 48 0c26.5 0 48-21.5 48-48l0-64c0-.4 0-.7 0-1.1zM96 256a64 64 0 1 1 128 0A64 64 0 1 1 96 256zm256-64a64 64 0 1 1 0 128 64 64 0 1 1 0-128z" /></svg>
        <span class="ml-2 text-xl font-semibold whitespace-nowrap">Pirates Footy Organiser</span>
    </NavBrand>
    <div class="ml-auto flex items-center gap-2">
        {#if $isLoading}<Spinner size="6" />{/if}
        <a
            class="cursor-default rounded-lg p-2.5 whitespace-normal text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 focus:outline-hidden sm:inline-block dark:text-gray-400 dark:hover:bg-gray-700"
            href={`/settings?date=${date}`}><AdjustmentsHorizontalSolid /></a>
        <DarkMode color="alternative" />
    </div>
</Navbar>
