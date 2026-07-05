<script>
    import { Alert, Button, Spinner } from 'flowbite-svelte';
    import { ExclamationCircleSolid, NewspaperOutline } from 'flowbite-svelte-icons';
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
    let visibleCount = $state(PAGE_SIZE);

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

    let visibleCards = $derived((cards ?? []).slice(0, visibleCount));
    let hasMore = $derived((cards ?? []).length > visibleCount);

    async function loadNews() {
        error = false;
        await withLoading(
            async () => {
                const response = await api.get('news');
                cards = response.cards;
            },
            (err) => {
                console.error('Error loading news feed:', err);
                error = true;
                setNotification(err.message || 'Failed to load the news feed', 'error');
            }
        );
    }

    $effect(() => {
        loadNews();
    });

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
        {#each visibleCards as card (card.date)}
            <NewsCard {card} />
        {/each}
    </div>
    {#if hasMore}
        <div class="mt-3 flex justify-center">
            <Button
                color="light"
                size="sm"
                onclick={() => (visibleCount += PAGE_SIZE)}>
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
