<script>
    import {
        Alert,
        Button,
        Spinner,
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell
    } from 'flowbite-svelte';
    import { ExclamationCircleSolid, WalletOutline } from 'flowbite-svelte-icons';
    import { pushState } from '$app/navigation';
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import FantasyTeamModal from '$components/FantasyTeamModal.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { titleParts } from '$lib/client/stores/pageTitle.js';
    import { formatDisplayDate } from '$lib/shared/helpers.js';

    let { data } = $props();
    let date = $derived(data.date);

    /** @type {any} */
    let fantasy = $state(null);
    let error = $state(false);

    let entries = $derived(fantasy?.entries ?? []);
    let priceOf = $derived(
        Object.fromEntries((fantasy?.market ?? []).map((entry) => [entry.playerName, entry]))
    );

    // Shallow routing, so the modal is dismissible with the browser back button.
    let selectedTeam = $state(null);
    let showModal = $state(false);

    $effect(() => {
        const state = page.state.fantasyEntry;
        showModal = !!state;
        if (state?.teamName) {
            selectedTeam = entries.find((entry) => entry.teamName === state.teamName) ?? null;
        }
    });

    /** The picked squad shaped for the pitch view. */
    let modalPlayers = $derived(
        (selectedTeam?.players ?? []).map((name) => ({
            name,
            avatar: priceOf[name]?.avatar ?? null,
            elo: priceOf[name]?.elo ?? null
        }))
    );

    let modalStats = $derived(
        Object.fromEntries(
            (selectedTeam?.players ?? []).map((name) => [
                name,
                { price: priceOf[name]?.price ?? 0, points: priceOf[name]?.points ?? 0 }
            ])
        )
    );

    async function loadFantasy() {
        error = false;
        await withLoading(
            async () => {
                fantasy = await api.get('fantasy', date);
            },
            (err) => {
                console.error('Error loading fantasy league:', err);
                error = true;
                setNotification(err.message || 'Failed to load fantasy league', 'error');
            }
        );
    }

    $effect(() => {
        if (date) loadFantasy();
    });

    $effect(() => {
        titleParts.set(['Fantasy']);
        return () => titleParts.set([]);
    });
</script>

<div class="mb-2 flex items-start justify-between gap-2">
    <div>
        <h5 class="flex items-center text-lg font-bold">Fantasy League</h5>
        <p class="text-sm text-gray-400">
            {formatDisplayDate(date)}
            {#if fantasy?.budget}
                · {fantasy.squadSize} players for {fantasy.budget}
            {/if}
        </p>
    </div>
    <Button
        href={resolve(`/fantasy/team?date=${date}`)}
        color="primary"
        size="sm"
        class="flex shrink-0 items-center gap-2">
        <WalletOutline class="h-4 w-4" />
        {fantasy?.myEntry ? 'My Squad' : 'Pick a Squad'}
    </Button>
</div>

{#if $isLoading}
    <div class="flex items-center justify-center gap-2 p-8">
        <Spinner size="6" />
        <div class="text-gray-500">Loading fantasy league...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load the fantasy league. Please try again.</span>
    </Alert>
{:else}
    {#if fantasy?.settleHint}
        <Alert class="glass mb-2 flex items-center border">
            <ExclamationCircleSolid />
            <span>{fantasy.settleHint}</span>
        </Alert>
    {/if}

    {#if entries.length === 0}
        <div class="py-8 text-center">
            <WalletOutline class="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p class="text-gray-500">
                {fantasy?.windowState === 'pending'
                    ? 'The fantasy market opens when teams are drawn.'
                    : 'No squads entered yet. Be the first.'}
            </p>
        </div>
    {:else}
        <Table
            classes={{ div: 'w-full overflow-hidden text-xs' }}
            class="w-full table-auto sm:table-fixed dark:text-gray-300"
            shadow>
            <TableHead class="dark:text-gray-300">
                <TableHeadCell class="w-6 px-1 py-1.5 text-center">#</TableHeadCell>
                <TableHeadCell
                    class="w-full max-w-0 overflow-hidden px-0 py-1.5 font-bold text-ellipsis text-gray-900 dark:text-white">
                    Squad
                </TableHeadCell>
                <TableHeadCell class="w-px px-1 py-1.5 text-center sm:w-14">Cost</TableHeadCell>
                <TableHeadCell class="w-px px-1 py-1.5 text-center sm:w-14">Points</TableHeadCell>
            </TableHead>
            <TableBody>
                {#each entries as entry (entry.teamName + entry.ownerName)}
                    <TableBodyRow
                        class="cursor-pointer {entry.isMine
                            ? 'border-l-primary-500 border-l-2'
                            : ''}"
                        onclick={() =>
                            pushState('', { fantasyEntry: { teamName: entry.teamName } })}>
                        <TableBodyCell class="px-1 py-1.5 text-center">{entry.rank}</TableBodyCell>
                        <TableBodyCell class="w-full max-w-0 px-0 py-1.5">
                            <span
                                class="block min-w-0 overflow-hidden font-medium text-ellipsis whitespace-nowrap text-gray-900 dark:text-white">
                                {entry.teamName}
                            </span>
                            <span
                                class="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {entry.ownerName}
                            </span>
                        </TableBodyCell>
                        <TableBodyCell class="px-1 py-1.5 text-center">{entry.cost}</TableBodyCell>
                        <TableBodyCell class="px-1 py-1.5 text-center font-bold">
                            {entry.points === null ? '—' : entry.points}
                        </TableBodyCell>
                    </TableBodyRow>
                {/each}
            </TableBody>
        </Table>
    {/if}
{/if}

<FantasyTeamModal
    bind:open={showModal}
    teamName={selectedTeam?.teamName}
    ownerName={selectedTeam?.ownerName}
    players={modalPlayers}
    playerStats={modalStats}
    cost={selectedTeam?.cost}
    points={selectedTeam?.points}
    onclose={() => {
        if (page.state.fantasyEntry) history.back();
    }} />
