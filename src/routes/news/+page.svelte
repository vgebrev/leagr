<script>
    import { Alert, Button, Spinner } from 'flowbite-svelte';
    import { ExclamationCircleSolid, NewspaperOutline } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { page } from '$app/state';
    import NewsCard from '$components/NewsCard.svelte';
    import PlayerModal from '$components/PlayerModal.svelte';
    import TeamModal from '$components/TeamModal.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    const PAGE_SIZE = 5;

    /** @type {Array<any>|null} */
    let cards = $state(null);
    let error = $state(false);
    let hasMore = $state(false);
    /** @type {string|null} */
    let nextCursor = $state(null);
    /** Viewing clock resolved by the server, pinned so later pages agree */
    let asOf = $state('');
    let loadingMore = $state(false);

    // News cards open these via pushState; the payload carries the card's date
    // so each modal shows that session's context.
    let showPlayerModal = $state(false);
    /** @type {string | null} */
    let selectedPlayer = $state(null);
    /** @type {string | null} */
    let selectedTeam = $state(null);
    let showTeamModal = $state(false);
    /** @type {string | null} */
    let modalDate = $state(null);

    $effect(() => {
        const state = page.state.playerModal;
        showPlayerModal = !!state;
        if (state?.playerName) {
            selectedPlayer = state.playerName;
            modalDate = state.date ?? null;
        }
    });

    $effect(() => {
        const state = page.state.teamModal;
        showTeamModal = !!state;
        if (state?.teamName) {
            selectedTeam = state.teamName;
            modalDate = state.date ?? null;
        }
    });

    function handlePlayerModalClose() {
        if (page.state.playerModal) history.back();
    }

    function handleTeamModalClose() {
        if (page.state.teamModal) history.back();
    }

    async function loadNews() {
        error = false;
        await withLoading(
            async () => {
                const response = await api.get(`news?limit=${PAGE_SIZE}`);
                cards = response.cards;
                hasMore = !!response.hasMore;
                nextCursor = response.nextCursor ?? null;
                asOf = response.asOf ?? '';
            },
            (err) => {
                console.error('Error loading news feed:', err);
                error = true;
                setNotification(err.message || 'Failed to load the news feed', 'error');
            }
        );
    }

    /**
     * Fetch the next batch of recap cards and append them. Deliberately not
     * wrapped in withLoading: that spinner replaces the whole feed, unmounting
     * the cards the reader is already looking at.
     */
    async function loadMore() {
        if (loadingMore || !hasMore || !nextCursor) return;
        loadingMore = true;
        try {
            const params = new SvelteURLSearchParams({
                limit: String(PAGE_SIZE),
                before: nextCursor
            });
            if (asOf) params.set('asOf', asOf);
            const response = await api.get(`news?${params}`);
            const seen = new Set((cards ?? []).map((card) => card.date));
            cards = [
                ...(cards ?? []),
                ...(response.cards ?? []).filter((card) => !seen.has(card.date))
            ];
            hasMore = !!response.hasMore;
            nextCursor = response.nextCursor ?? null;
        } catch (err) {
            console.error('Error loading more news:', err);
            setNotification(err.message || 'Failed to load more stories', 'error');
        } finally {
            loadingMore = false;
        }
    }

    // Not an $effect: loadNews reads the api client's auth state synchronously,
    // so an effect would re-run (and reset the feed to page 1) when the admin
    // code lands after mount. The page has no reactive inputs.
    onMount(loadNews);

    $effect(() => {
        titleParts.set(['News']);
        return () => titleParts.set([]);
    });
</script>

<!-- Header -->
<div class="mb-2 flex items-start justify-between">
    <div>
        <h5 class="flex items-center text-lg font-bold">News</h5>
        <p class="text-sm text-gray-400">Session previews and recaps from the form desk</p>
    </div>
</div>

{#if $isLoading}
    <div class="flex items-center justify-center gap-2 p-8">
        <Spinner size="6" />
        <div class="text-gray-500">Loading the latest stories...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load the news feed. Please try again.</span>
    </Alert>
{:else if cards == null}
    <div class="py-8 text-center">
        <NewspaperOutline class="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p class="text-gray-500">
            The news feed follows player form, which is disabled for this league.
        </p>
    </div>
{:else}
    <div class="flex flex-col gap-3">
        {#each cards as card (card.date)}
            <NewsCard {card} />
        {/each}
    </div>
    {#if hasMore}
        <div class="mt-3 flex justify-center">
            <Button
                color="light"
                size="sm"
                disabled={loadingMore}
                onclick={loadMore}>
                {#if loadingMore}
                    <Spinner
                        size="4"
                        class="me-2" />
                {/if}
                Load more
            </Button>
        </div>
    {/if}
{/if}

<PlayerModal
    bind:playerName={selectedPlayer}
    bind:open={showPlayerModal}
    date={modalDate}
    onclose={handlePlayerModalClose} />

<TeamModal
    bind:teamName={selectedTeam}
    bind:open={showTeamModal}
    date={modalDate}
    onclose={handleTeamModalClose} />
