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
        TableHeadCell,
        TabItem,
        Tabs
    } from 'flowbite-svelte';
    import { ChevronDownOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyPopover from '$components/TrophyPopover.svelte';
    import MomentumBoard from '$components/MomentumBoard.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { getYearOptions } from '$lib/shared/yearConfig.js';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { resolve } from '$app/paths';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    let champions = $state([]);
    /** @type {Array<any>|null} */
    let momentum = $state(null);
    let error = $state(false);
    let yearDropdownOpen = $state(false);

    // Get selected year from URL, default to "all"
    let selectedYear = $derived.by(() => {
        const yearParam = page.url.searchParams.get('year');
        return yearParam || new Date().getFullYear();
    });

    // Generate year options with "All" option
    let yearOptions = $derived.by(() => {
        return [...getYearOptions(), { value: 'all', name: 'all' }];
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
                momentum = response.momentum || null;
            },
            (err) => {
                console.error('Error loading champions:', err);
                error = true;
                setNotification(err.message || 'Failed to load champions data', 'error');
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

    // Load champions when selectedYear changes (including on mount)
    $effect(() => {
        if (selectedYear) {
            // Track the year
            loadChampions(); // Reload when year changes
        }
    });

    /** @param {string} playerName */
    function handlePlayerClick(playerName) {
        goto(resolve(`/rankings/${playerName}`));
    }

    $effect(() => {
        titleParts.set(['Champions']);
        return () => titleParts.set([]);
    });
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
        <div class="text-gray-500">Loading champions data...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load champions data. Please try again.</span>
    </Alert>
{:else if momentum?.length}
    <Tabs
        tabStyle="underline"
        contentClass="pt-2">
        <TabItem
            open
            title="Champions">
            {@render championsList()}
        </TabItem>
        <TabItem title="Form">
            <MomentumBoard
                entries={momentum}
                variant="champions" />
        </TabItem>
    </Tabs>
{:else}
    {@render championsList()}
{/if}

{#snippet championsList()}
    {#if champions.length === 0}
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
                            <span
                                class="cursor-pointer hover:underline"
                                role="button"
                                tabindex="0"
                                onclick={() => handlePlayerClick(champion.playerName)}
                                onkeydown={() => handlePlayerClick(champion.playerName)}>
                                {champion.playerName}
                            </span>
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
{/snippet}
