<script>
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { Button, Toggle, Tooltip, Dropdown, DropdownItem } from 'flowbite-svelte';
    import { QuestionCircleOutline, ChevronDownOutline } from 'flowbite-svelte-icons';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
    import RankingInfoPanel from './components/RankingInfoPanel.svelte';
    import RankingsTable from './components/RankingsTable.svelte';
    import RankingActions from './components/RankingActions.svelte';
    import { MAX_YEAR, getYearOptions } from '$lib/shared/yearConfig.js';
    import { SvelteURLSearchParams } from 'svelte/reactivity';

    let rankings = $state({ players: {}, rankingMetadata: {} });
    let sortBy = $state('rankingPoints'); // Default to ranking points
    let showActiveOnly = $state(true); // Default to showing active players only
    let yearDropdownOpen = $state(false);

    // Get selected year from URL, default to MAX_YEAR
    let selectedYear = $derived.by(() => {
        const yearParam = page.url.searchParams.get('year');
        return yearParam ? parseInt(yearParam, 10) : MAX_YEAR;
    });

    // Generate year options from config
    let yearOptions = $derived(getYearOptions());

    // Preserve date parameter when navigating to champions
    let championsUrl = $derived.by(() => {
        const dateParam = page.url.searchParams.get('date');
        return dateParam ? `/champions?date=${dateParam}` : '/champions';
    });

    // Preserve date parameter when navigating to golden boot
    let goldenBootUrl = $derived.by(() => {
        const dateParam = page.url.searchParams.get('date');
        return dateParam ? `/golden-boot?date=${dateParam}` : '/golden-boot';
    });

    /**
     * Check if a player is active (has appeared within last 2 months and has 2+ appearances)
     * @param {string|null} lastAppearance - Last appearance date (YYYY-MM-DD)
     * @param {number} appearances - Total number of appearances
     * @returns {boolean}
     */
    function isPlayerActive(lastAppearance, appearances) {
        if (!lastAppearance || appearances < 2) return false;

        const today = new Date();
        const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());
        const lastAppearanceDate = new Date(lastAppearance);

        return lastAppearanceDate >= twoMonthsAgo;
    }

    /**
     * Recalculate rank movement for filtered players
     * @param {Array} players - Filtered and sorted players array
     * @returns {Array} - Players with adjusted rank movement
     */
    function adjustRankMovement(players) {
        return players.map(([name, data], index) => {
            const currentRankInView = index + 1;

            // Find player's previous rank in the filtered view
            // For simplicity, we'll keep the original rank movement for now
            // A more sophisticated implementation would track filtered rankings over time

            return [
                name,
                {
                    ...data,
                    adjustedRank: currentRankInView
                }
            ];
        });
    }

    let sortedPlayers = $derived.by(() => {
        const filtered = Object.entries(rankings.players ?? {})
            .filter(([, data]) => {
                // Apply active player filter if enabled (exclude inactive and provisional players)
                return !showActiveOnly || isPlayerActive(data.lastAppearance, data.appearances);
            })
            .sort((a, b) => {
                if (sortBy === 'rankingPoints') {
                    if (b[1].rankingPoints !== a[1].rankingPoints)
                        return b[1].rankingPoints - a[1].rankingPoints;
                    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                    // Tertiary tiebreaker: ELO rating
                    const aElo = a[1].elo?.rating || 0;
                    const bElo = b[1].elo?.rating || 0;
                    return bElo - aElo;
                } else if (sortBy === 'rawAverage') {
                    if (b[1].rawAverage !== a[1].rawAverage)
                        return b[1].rawAverage - a[1].rawAverage;
                    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                    return b[1].appearances - a[1].appearances;
                } else if (sortBy === 'points') {
                    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                    return b[1].appearances - a[1].appearances;
                } else if (sortBy === 'appearances') {
                    if (b[1].appearances !== a[1].appearances)
                        return b[1].appearances - a[1].appearances;
                    return b[1].points - a[1].points;
                } else if (sortBy === 'elo') {
                    const aElo = a[1].elo?.rating || 0;
                    const bElo = b[1].elo?.rating || 0;
                    if (bElo !== aElo) return bElo - aElo;
                    return b[1].rankingPoints - a[1].rankingPoints;
                } else {
                    return 0;
                }
            });

        return adjustRankMovement(filtered);
    });

    /**
     * Load rankings for the selected year
     */
    async function loadRankings() {
        await withLoading(
            async () => {
                const url = `rankings?year=${selectedYear}`;
                rankings = await api.get(url);
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Unable to load rankings. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Update rankings for the selected year
     */
    async function updateRankings() {
        await withLoading(
            async () => {
                const url = `rankings?year=${selectedYear}`;
                rankings = await api.post(url);
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Unable to update rankings. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Handle year change - update URL and reload data
     * @param {number} newYear
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

    /** Handle sort change event
     * @param {string} newSort */
    function handleSortChange(newSort) {
        sortBy = newSort;
    }

    // Load rankings when selectedYear changes (including on mount)
    $effect(() => {
        if (selectedYear) {
            // Track the year
            loadRankings(); // Reload when year changes
        }
    });

    // Auto-adjust "regular players only" filter based on available sessions
    $effect(() => {
        const dates = rankings.calculatedDates;
        if (dates) {
            // Enable filter when we have enough data (5+ sessions), disable otherwise
            showActiveOnly = dates.length >= 5;
        }
    });
</script>

<div class="flex flex-col gap-2">
    <RankingInfoPanel rankingMetadata={rankings.rankingMetadata} />

    <div class="flex gap-2">
        <Button
            href={championsUrl}
            color="primary"
            size="sm"
            class="flex flex-1 items-center justify-center gap-2">
            <TrophyIcon class="h-4 w-4" />
            Champions Hall
        </Button>
        <Button
            href={goldenBootUrl}
            color="primary"
            size="sm"
            class="flex flex-1 items-center justify-center gap-2">
            <SoccerBootIcon class="h-4 w-4" />
            Golden Boot
        </Button>
    </div>

    <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-1">
            <Toggle
                bind:checked={showActiveOnly}
                class="text-sm">
                Regular players only
            </Toggle>
            <QuestionCircleOutline
                class="h-4 w-4 cursor-help text-gray-400 hover:text-gray-600"
                id="regular-players-help" />
            <Tooltip
                triggeredBy="#regular-players-help"
                class="text-xs">
                2+ appearances in the last 2 months
            </Tooltip>
        </div>

        <div class="ml-auto flex items-center gap-1">
            <span class="text-xs">Year</span>
            <Button
                color="light"
                size="xs"
                class="flex items-center gap-1">
                {selectedYear}
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
    <div class="overflow-x-auto">
        <RankingsTable
            {sortedPlayers}
            currentSort={sortBy}
            onSortChange={handleSortChange}
            year={selectedYear} />
    </div>
    <RankingActions onUpdate={updateRankings} />
</div>
