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
    import { ExclamationCircleSolid, UsersGroupOutline } from 'flowbite-svelte-icons';
    import WizardHatIcon from '$components/Icons/WizardHatIcon.svelte';
    import { pushState } from '$app/navigation';
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import FantasyTeamModal from '$components/FantasyTeamModal.svelte';
    import FantasyInfoPanel from './components/FantasyInfoPanel.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    let { data } = $props();
    let date = $derived(data.date);

    /** @type {any} */
    let fantasy = $state(null);
    let error = $state(false);

    let entries = $derived(fantasy?.entries ?? []);
    // Until editing locks, the server sends every squad but your own without its picks —
    // so a row that cannot be opened is a row there is nothing to open.
    let squadsRevealed = $derived(fantasy?.squadsRevealed !== false);
    /** @param {any} entry */
    const canOpen = (entry) => squadsRevealed || entry.isMine;
    let priceOf = $derived(
        Object.fromEntries((fantasy?.market ?? []).map((entry) => [entry.playerName, entry]))
    );

    // Shallow routing, so the modal is dismissible with the browser back button.
    let selectedTeam = $state(null);
    let showModal = $state(false);

    $effect(() => {
        const state = page.state.fantasyEntry;
        const entry = state?.teamName
            ? (entries.find((candidate) => candidate.teamName === state.teamName) ?? null)
            : null;
        // A back-button history entry can outlive the reveal it was made under, so the
        // guard lives here as well as on the row: no picks, no pitch.
        showModal = !!state && (!entry || canOpen(entry));
        if (state?.teamName) selectedTeam = entry;
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
                { price: priceOf[name]?.price ?? 0, points: priceOf[name]?.points ?? null }
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

<div class="mb-2">
    <h5 class="flex items-center text-lg font-bold">Weekly Fantasy League</h5>
    {#if fantasy?.budget}
        <p class="text-sm text-gray-400">
            <span>Pick {fantasy.squadSize} players for ${fantasy.budget}m</span>
        </p>
    {/if}
</div>

<Button
    href={resolve(`/fantasy/team?date=${date}`)}
    color="primary"
    size="sm"
    class="mb-3 w-full">
    <UsersGroupOutline class="me-2 h-4 w-4 shrink-0" />
    {fantasy?.myEntry ? 'My Squad' : 'Pick a Squad'}
</Button>

<div class="mb-2">
    <FantasyInfoPanel
        squadSize={fantasy?.squadSize ?? 0}
        budget={fantasy?.budget ?? 0}
        scoring={fantasy?.scoring ?? {}}
        statTypes={fantasy?.statTypes ?? []} />
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
            <WizardHatIcon class="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p class="text-gray-500">
                {fantasy?.windowState === 'pending'
                    ? 'The fantasy market opens when registration does.'
                    : !fantasy?.marketReady
                      ? fantasy?.marketNotice
                      : 'No squads entered yet. Be the first.'}
            </p>
        </div>
    {:else}
        <Table
            classes={{ div: 'w-full overflow-hidden text-xs' }}
            class="w-full table-auto sm:table-fixed dark:text-gray-300"
            shadow>
            <TableHead class="dark:text-gray-300">
                <TableHeadCell class="w-6 px-2 py-1.5 text-center">#</TableHeadCell>
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
                        class="{canOpen(entry) ? 'cursor-pointer' : ''} {entry.isMine
                            ? 'border-l-primary-500 border-l-2'
                            : ''}"
                        onclick={() => {
                            if (canOpen(entry)) {
                                pushState('', { fantasyEntry: { teamName: entry.teamName } });
                            }
                        }}>
                        <TableBodyCell class="px-2 py-1.5 text-center">
                            {entry.rank ?? '—'}
                        </TableBodyCell>
                        <TableBodyCell class="w-full max-w-0 px-0 py-1.5">
                            <span
                                class="block min-w-0 overflow-hidden font-medium text-ellipsis whitespace-nowrap text-gray-900 dark:text-white">
                                {entry.teamName}
                            </span>
                            <span
                                class="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {entry.valid ? entry.ownerName : 'over budget — not scored'}
                            </span>
                        </TableBodyCell>
                        <TableBodyCell
                            class="px-1 py-1.5 text-center {entry.valid
                                ? ''
                                : 'text-primary-600 font-bold'}">
                            ${entry.cost}m
                        </TableBodyCell>
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
    withdrawnPlayers={selectedTeam?.withdrawnPlayers ?? []}
    captain={selectedTeam?.captain ?? null}
    onclose={() => {
        if (page.state.fantasyEntry) history.back();
    }} />
