<script>
    import {
        Alert,
        Spinner,
        Table,
        TableHead,
        TableHeadCell,
        TableBody,
        TableBodyRow,
        TableBodyCell,
        Button,
        Dropdown,
        DropdownItem
    } from 'flowbite-svelte';
    import { ExclamationCircleSolid, ChevronDownOutline } from 'flowbite-svelte-icons';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyPopover from '$components/TrophyPopover.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { getYearOptions } from '$lib/shared/yearConfig.js';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { resolve } from '$app/paths';

    let champions = $state([]);
    let loading = $state(true);
    let error = $state(false);
    let celebrating = $state(false);
    let yearDropdownOpen = $state(false);
    let topChampion = $derived(champions.length > 0 ? champions[0].playerName : '');

    // Get selected year from URL, default to "all"
    let selectedYear = $derived.by(() => {
        const yearParam = page.url.searchParams.get('year');
        return yearParam || new Date().getFullYear();
    });

    // Generate year options with "All" option
    let yearOptions = $derived.by(() => {
        const options = [...getYearOptions(), { value: 'all', name: 'all' }];
        return options;
    });

    /**
     * Load champions data for selected year
     */
    async function loadChampions() {
        error = false;
        await withLoading(
            async () => {
                const url = `champions?year=${selectedYear}`;
                const response = await api.get(url);
                champions = response.champions || [];
            },
            (err) => {
                console.error('Error loading champions:', err);
                error = true;
                setNotification(err.message || 'Failed to load champions data', 'error');
            }
        );
        loading = false;
    }

    /**
     * Handle year change - update URL
     * @param {string|number} newYear
     */
    async function handleYearChange(newYear) {
        yearDropdownOpen = false;
        // Build an internal href preserving existing params
        const params = new SvelteURLSearchParams(page.url.search);
        params.set('year', String(newYear));
        const query = params.toString();
        const href = resolve(`${page.url.pathname}?${query}`, {});

        // Navigate and reload data
        await goto(href, { replaceState: true });
    }

    // Load champions when selectedYear changes (including on mount)
    $effect(() => {
        if (selectedYear) {
            // Track the year
            loadChampions(); // Reload when year changes
        }
    });

    /**
     * Handle click on top champion's name
     */
    function handleTopChampionClick() {
        if (champions.length > 0) {
            celebrating = true;
        }
    }
</script>

<!-- Header -->
<div class="mb-2 flex items-start justify-between">
    <div>
        <h5 class="flex items-center text-lg font-bold">Champions Hall</h5>
        <p class="text-sm text-gray-400">
            {selectedYear === 'all'
                ? 'All-time league and knockout cup winners'
                : `${selectedYear} league and knockout cup winners`}
        </p>
    </div>

    <!-- Year Selector -->
    <div class="flex items-center gap-1">
        <span class="text-xs">Year</span>
        <Button
            color="light"
            size="xs"
            class="flex items-center gap-1">
            {yearOptions.find((opt) => opt.value == selectedYear)?.name || selectedYear}
            <ChevronDownOutline class="h-4 w-4" />
        </Button>
        <Dropdown
            simple
            class="w-20 border border-gray-200 dark:border-gray-700 dark:bg-gray-800"
            bind:isOpen={yearDropdownOpen}>
            {#each yearOptions as option, i (i)}
                <DropdownItem
                    onclick={() => handleYearChange(option.value)}
                    class={`w-full py-1 text-sm dark:bg-gray-800 dark:hover:bg-gray-700 ${
                        selectedYear === option.value
                            ? 'text-primary-600 w-full bg-gray-100 dark:bg-gray-700'
                            : ''
                    }`}>
                    {option.name}
                </DropdownItem>
            {/each}
        </Dropdown>
    </div>
</div>

{#if loading}
    <div class="flex items-center justify-center gap-2 p-8">
        <Spinner size="6" />
        <div class="text-gray-500">Loading champions data...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load champions data. Please try again.</span>
    </Alert>
{:else if champions.length === 0}
    <div class="py-8 text-center">
        <TrophyIcon class="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p class="text-gray-500">No champions yet! Be the first to win a league or cup.</p>
    </div>
{:else}
    <Table
        classes={{ div: 'w-full text-xs' }}
        class="dark:text-gray-300"
        shadow>
        <TableHead class="dark:text-gray-300">
            <TableHeadCell class="px-1 py-1.5 text-center">#</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 font-bold text-gray-900 dark:text-gray-100"
                >Player</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">League Wins</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">Cup Wins</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">Total</TableHeadCell>
        </TableHead>
        <TableBody>
            {#each champions as champion, index (index)}
                <TableBodyRow>
                    <TableBodyCell class="px-1 py-1.5 text-center">{index + 1}</TableBodyCell>
                    <TableBodyCell
                        class="px-1 py-1.5 font-semibold text-gray-900 dark:text-gray-100">
                        {#if index === 0}
                            <button onclick={handleTopChampionClick}>
                                {champion.playerName}
                            </button>
                        {:else}
                            {champion.playerName}
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {#if champion.leagueWins > 0}
                            <button
                                class="mx-auto flex cursor-pointer items-center gap-1 text-yellow-600 hover:text-yellow-700"
                                id="league-{index}">
                                <CrownIcon class="h-4 w-4" />
                                {champion.leagueWins}
                            </button>
                            <TrophyPopover
                                triggerId="league-{index}"
                                playerName={champion.playerName}
                                trophyType="league" />
                        {:else}
                            <span class="text-gray-400 dark:text-gray-300">0</span>
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {#if champion.cupWins > 0}
                            <button
                                class="mx-auto flex cursor-pointer items-center gap-1 text-amber-600 hover:text-amber-700"
                                id="cup-{index}">
                                <TrophyIcon class="h-4 w-4" />
                                {champion.cupWins}
                            </button>
                            <TrophyPopover
                                triggerId="cup-{index}"
                                playerName={champion.playerName}
                                trophyType="cup" />
                        {:else}
                            <span class="text-gray-400 dark:text-gray-300">0</span>
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center font-medium"
                        >{champion.totalChampionships}</TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{/if}

<CelebrationOverlay
    bind:celebrating
    teamName={topChampion}
    teamColour="default"
    icon="👑"
    confettiColours={['#fbbf24', '#fde047', '#facc15']} />
