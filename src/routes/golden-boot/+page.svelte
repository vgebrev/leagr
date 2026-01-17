<script>
    import {
        Alert,
        Button,
        Dropdown,
        DropdownItem,
        Spinner,
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell
    } from 'flowbite-svelte';
    import { ChevronDownOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { getYearOptions } from '$lib/shared/yearConfig.js';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { resolve } from '$app/paths';

    let scorers = $state([]);
    let error = $state(false);
    let celebrating = $state(false);
    let yearDropdownOpen = $state(false);
    let topScorer = $derived(scorers.length > 0 ? scorers[0].playerName : '');

    // Get selected year from URL, default to current year
    let selectedYear = $derived.by(() => {
        const yearParam = page.url.searchParams.get('year');
        return yearParam || new Date().getFullYear();
    });

    // Generate year options with "All" option
    let yearOptions = $derived.by(() => {
        return [...getYearOptions(), { value: 'all', name: 'all' }];
    });

    /**
     * Load golden boot data for selected year
     */
    async function loadGoldenBoot() {
        error = false;
        await withLoading(
            async () => {
                const url = `golden-boot?year=${selectedYear}`;
                const response = await api.get(url);
                scorers = response.scorers || [];
            },
            (err) => {
                console.error('Error loading golden boot data:', err);
                error = true;
                setNotification(err.message || 'Failed to load golden boot data', 'error');
            }
        );
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

    // Load golden boot when selectedYear changes (including on mount)
    $effect(() => {
        if (selectedYear) {
            // Track the year
            loadGoldenBoot(); // Reload when year changes
        }
    });

    /**
     * Handle click on top scorer's name
     */
    function handleTopScorerClick() {
        if (scorers.length > 0) {
            celebrating = true;
        }
    }
</script>

<!-- Header -->
<div class="mb-2 flex items-start justify-between">
    <div>
        <h5 class="flex items-center text-lg font-bold">Golden Boot</h5>
        <p class="text-sm text-gray-400">
            {selectedYear === 'all' ? 'All-time top scorers' : `${selectedYear} top scorers`}
        </p>
    </div>

    <!-- Year Selector -->
    <div class="flex items-center gap-1">
        <span class="text-xs">Year</span>
        <Button
            color="light"
            size="xs"
            class="flex items-center gap-1">
            {yearOptions.find((opt) => opt.value === selectedYear)?.name || selectedYear}
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

{#if $isLoading}
    <div class="flex items-center justify-center gap-2 p-8">
        <Spinner size="6" />
        <div class="text-gray-500">Loading golden boot data...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load golden boot data. Please try again.</span>
    </Alert>
{:else if scorers.length === 0}
    <div class="py-8 text-center">
        <SoccerBootIcon class="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p class="text-gray-500">No goals recorded yet! Start tracking goal scorers in matches.</p>
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
            <TableHeadCell class="px-1 py-1.5 text-center text-gray-400">League</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center text-gray-400">Cup</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center font-bold">Total</TableHeadCell>
        </TableHead>
        <TableBody>
            {#each scorers as scorer, index (index)}
                <TableBodyRow>
                    <TableBodyCell class="px-1 py-1.5 text-center">{index + 1}</TableBodyCell>
                    <TableBodyCell
                        class="px-1 py-1.5 font-bold text-gray-900 dark:text-gray-100">
                        {#if index === 0}
                            <button
                                onclick={handleTopScorerClick}
                                class="flex items-center gap-1">
                                {scorer.playerName}
                            </button>
                        {:else}
                            {scorer.playerName}
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center text-gray-400">
                        <span class="text-gray-400">{scorer.leagueGoals}</span>
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center text-gray-400">
                        <span>{scorer.cupGoals}</span>
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center font-bold"
                        >{scorer.totalGoals}</TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{/if}

<CelebrationOverlay
    bind:celebrating
    teamName={topScorer}
    teamColour="default"
    icon="⚽"
    confettiColours={['#d97706', '#f59e0b', '#fbbf24']} />
