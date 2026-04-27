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
    import { ChevronDownOutline, ExclamationCircleSolid, StarSolid } from 'flowbite-svelte-icons';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { getYearOptions } from '$lib/shared/yearConfig.js';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { resolve } from '$app/paths';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    /** @type {Array<{playerName: string, appearances: number, saves: number, defence: number, attack: number, goals: number, total: number}>} */
    let ballers = $state([]);
    let error = $state(false);
    let yearDropdownOpen = $state(false);

    /** @type {'appearances'|'saves'|'defence'|'attack'|'goals'|'total'} */
    let sortCol = $state('total');
    let sortAsc = $state(false);

    let selectedYear = $derived.by(() => {
        const yearParam = page.url.searchParams.get('year');
        return yearParam || new Date().getFullYear();
    });

    let yearOptions = $derived([...getYearOptions(), { value: 'all', name: 'all' }]);

    let sorted = $derived.by(() => {
        return [...ballers].sort((a, b) => {
            const diff = b[sortCol] - a[sortCol];
            return sortAsc ? -diff : diff;
        });
    });

    /**
     * Get the leader's name for a given stat, or null if no one has a non-zero value
     * @param {'total'|'goals'|'defence'|'attack'|'saves'} stat
     */
    function leader(stat) {
        if (ballers.length === 0) return null;
        const top = ballers.reduce((a, b) => (b[stat] > a[stat] ? b : a));
        return top[stat] > 0 ? top.playerName : null;
    }

    let leaders = $derived({
        total: leader('total'),
        goals: leader('goals'),
        defence: leader('defence'),
        attack: leader('attack'),
        saves: leader('saves')
    });

    async function loadBallers() {
        error = false;
        await withLoading(
            async () => {
                const response = await api.get(`ballers-board?year=${selectedYear}`);
                ballers = response.ballers || [];
            },
            (err) => {
                console.error('Error loading ballers board:', err);
                error = true;
                setNotification(err.message || 'Failed to load ballers board', 'error');
            }
        );
    }

    /** @param {string|number} newYear */
    async function handleYearChange(newYear) {
        yearDropdownOpen = false;
        const params = new SvelteURLSearchParams(page.url.search);
        params.set('year', String(newYear));
        const href = resolve(`${page.url.pathname}?${params.toString()}`, {});
        await goto(href, { replaceState: true });
    }

    /**
     * @param {'appearances'|'saves'|'defence'|'attack'|'goals'|'total'} col
     */
    function handleSort(col) {
        if (sortCol === col) {
            sortAsc = !sortAsc;
        } else {
            sortCol = col;
            sortAsc = false;
        }
    }

    $effect(() => {
        if (selectedYear) {
            loadBallers();
        }
    });

    $effect(() => {
        titleParts.set(['Ballers Board']);
        return () => titleParts.set([]);
    });
</script>

<!-- Header -->
<div class="mb-2 flex items-start justify-between">
    <div>
        <h5 class="flex items-center text-lg font-bold">Ballers Board</h5>
        <p class="text-sm text-gray-400">
            {selectedYear === 'all'
                ? 'All-time individual stats leaders'
                : `${selectedYear} individual stats leaders`}
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
        <div class="text-gray-500">Loading ballers board...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load ballers board. Please try again.</span>
    </Alert>
{:else if sorted.length === 0}
    <div class="py-8 text-center">
        <StarSolid class="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p class="text-gray-500">No individual stats recorded yet.</p>
    </div>
{:else}
    {@const cols = [
        { key: 'appearances', label: 'Apps', width: 'w-10 lg:w-14 2xl:w-20' },
        { key: 'saves', label: 'Saves', width: 'w-10 lg:w-14 2xl:w-20' },
        { key: 'defence', label: 'DEF', width: 'w-10 lg:w-14 2xl:w-20' },
        { key: 'attack', label: 'ATT', width: 'w-10 lg:w-14 2xl:w-20' },
        { key: 'goals', label: 'Goals', width: 'w-12 lg:w-14 2xl:w-20' },
        { key: 'total', label: 'Total', width: 'w-12 lg:w-14 2xl:w-20' }
    ]}
    <Table
        classes={{ div: 'w-full overflow-hidden text-xs' }}
        class="w-full table-fixed dark:text-gray-300"
        shadow>
        <TableHead class="dark:text-gray-300">
            <TableHeadCell class="w-6 px-1 py-1.5 text-center">#</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 font-bold text-gray-900 dark:text-white"
                >Player</TableHeadCell>
            {#each cols as col (col.key)}
                <TableHeadCell
                    class={`${col.width} cursor-pointer px-1 py-1.5 text-center select-none ${
                        col.key === 'total' || sortCol === col.key
                            ? 'font-bold dark:text-white'
                            : 'font-medium text-gray-500 dark:text-gray-300'
                    }`}
                    onclick={() => handleSort(col.key)}>
                    {col.label}
                </TableHeadCell>
            {/each}
        </TableHead>
        <TableBody>
            {#each sorted as baller, index (baller.playerName)}
                <TableBodyRow>
                    <TableBodyCell class="px-1 py-1.5 text-center">{index + 1}</TableBodyCell>
                    <TableBodyCell
                        class="max-w-0 px-1 py-1.5 font-bold text-gray-900 dark:text-white">
                        <span class="flex min-w-0 items-center gap-1">
                            <span class="overflow-hidden text-ellipsis whitespace-nowrap"
                                >{baller.playerName}</span>
                            {#if leaders.total === baller.playerName}<StarSolid
                                    class="h-4 w-4 shrink-0 text-yellow-400" />{/if}
                            {#if leaders.goals === baller.playerName}<LeagueIcon
                                    class="h-4 w-4 shrink-0 text-yellow-400" />{/if}
                            {#if leaders.attack === baller.playerName}<BullseyeIcon
                                    class="h-4 w-4 shrink-0 text-yellow-400" />{/if}
                            {#if leaders.defence === baller.playerName}<ShieldIcon
                                    class="h-4 w-4 shrink-0 text-yellow-400" />{/if}
                            {#if leaders.saves === baller.playerName}<GloveIcon
                                    class="h-4 w-4 shrink-0 text-yellow-400" />{/if}
                        </span>
                    </TableBodyCell>
                    <TableBodyCell
                        class={`px-1 py-1.5 text-center ${sortCol === 'appearances' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}>
                        {baller.appearances}
                    </TableBodyCell>
                    <TableBodyCell
                        class={`px-1 py-1.5 text-center ${sortCol === 'saves' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}>
                        {baller.saves}
                    </TableBodyCell>
                    <TableBodyCell
                        class={`px-1 py-1.5 text-center ${sortCol === 'defence' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}>
                        {baller.defence}
                    </TableBodyCell>
                    <TableBodyCell
                        class={`px-1 py-1.5 text-center ${sortCol === 'attack' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}>
                        {baller.attack}
                    </TableBodyCell>
                    <TableBodyCell
                        class={`px-1 py-1.5 text-center ${sortCol === 'goals' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}>
                        {baller.goals}
                    </TableBodyCell>
                    <TableBodyCell
                        class="px-1 py-1.5 text-center font-bold text-gray-900 dark:text-white">
                        {baller.total}
                    </TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{/if}
