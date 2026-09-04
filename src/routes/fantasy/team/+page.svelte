<script>
    import { Alert, Button, Input, Label, Spinner } from 'flowbite-svelte';
    import { ArrowLeftOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { resolve } from '$app/paths';
    import FantasyTeamModal from '$components/FantasyTeamModal.svelte';
    import PlayerMarket from '../components/PlayerMarket.svelte';
    import SquadSummary from '../components/SquadSummary.svelte';
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
    let teamName = $state('');
    /** @type {string[]} */
    let picks = $state([]);
    let showPreview = $state(false);
    let saving = $state(false);

    let market = $derived(fantasy?.market ?? []);
    let squadSize = $derived(fantasy?.squadSize ?? 5);
    let budget = $derived(fantasy?.budget ?? 0);
    let readOnly = $derived(fantasy?.windowState !== 'open');

    let priceOf = $derived(Object.fromEntries(market.map((entry) => [entry.playerName, entry])));
    let cost = $derived(
        Math.round(picks.reduce((sum, name) => sum + (priceOf[name]?.price ?? 0), 0) * 2) / 2
    );
    let remaining = $derived(Math.round((budget - cost) * 2) / 2);
    let squadComplete = $derived(picks.length === squadSize);
    let canSave = $derived(
        !readOnly && !saving && squadComplete && cost <= budget && teamName.trim().length > 0
    );

    let previewPlayers = $derived(
        picks.map((name) => ({
            name,
            avatar: priceOf[name]?.avatar ?? null,
            elo: priceOf[name]?.elo ?? null
        }))
    );
    let previewStats = $derived(
        Object.fromEntries(
            picks.map((name) => [
                name,
                { price: priceOf[name]?.price ?? 0, points: priceOf[name]?.points ?? 0 }
            ])
        )
    );

    /**
     * Adopt a server payload as the source of truth, including after a save, so the form
     * always reflects what was actually stored.
     * @param {any} state
     */
    function adopt(state) {
        fantasy = state;
        teamName = state.myEntry?.teamName ?? teamName;
        picks = state.myEntry ? [...state.myEntry.players] : picks;
    }

    async function loadFantasy() {
        error = false;
        await withLoading(
            async () => {
                adopt(await api.get('fantasy', date));
            },
            (err) => {
                console.error('Error loading fantasy squad:', err);
                error = true;
                setNotification(err.message || 'Failed to load fantasy squad', 'error');
            }
        );
    }

    /** @param {string} playerName */
    function togglePick(playerName) {
        if (picks.includes(playerName)) {
            picks = picks.filter((name) => name !== playerName);
        } else if (picks.length < squadSize) {
            picks = [...picks, playerName];
        }
    }

    async function saveSquad() {
        saving = true;
        await withLoading(
            async () => {
                adopt(
                    await api.post('fantasy', date, { teamName: teamName.trim(), players: picks })
                );
                setNotification('Squad saved.', 'success');
            },
            (err) => {
                console.error('Error saving fantasy squad:', err);
                setNotification(err.message || 'Failed to save squad', 'error');
            }
        );
        saving = false;
    }

    async function withdrawSquad() {
        saving = true;
        await withLoading(
            async () => {
                const state = await api.remove('fantasy', date, null);
                fantasy = state;
                teamName = '';
                picks = [];
                setNotification('Squad withdrawn.', 'success');
            },
            (err) => {
                console.error('Error withdrawing fantasy squad:', err);
                setNotification(err.message || 'Failed to withdraw squad', 'error');
            }
        );
        saving = false;
    }

    $effect(() => {
        if (date) loadFantasy();
    });

    $effect(() => {
        titleParts.set(['My Squad', 'Fantasy']);
        return () => titleParts.set([]);
    });
</script>

<div class="mb-2 flex items-start justify-between gap-2">
    <div>
        <h5 class="flex items-center text-lg font-bold">My Fantasy Squad</h5>
        <p class="text-sm text-gray-400">
            {formatDisplayDate(date)}
            {#if budget}
                · pick {squadSize} for {budget}
            {/if}
        </p>
    </div>
    <Button
        href={resolve(`/fantasy?date=${date}`)}
        color="light"
        size="sm"
        class="flex shrink-0 items-center gap-2">
        <ArrowLeftOutline class="h-4 w-4" />
        Leaderboard
    </Button>
</div>

{#if $isLoading && !fantasy}
    <div class="flex items-center justify-center gap-2 p-8">
        <Spinner size="6" />
        <div class="text-gray-500">Loading the market...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load the fantasy market. Please try again.</span>
    </Alert>
{:else}
    {#if readOnly && fantasy?.windowReason}
        <Alert class="glass mb-2 flex items-center border">
            <ExclamationCircleSolid />
            <span>{fantasy.windowReason}</span>
        </Alert>
    {/if}

    <div class="mb-2">
        <Label
            for="fantasy-team-name"
            class="mb-1 text-sm">Squad name</Label>
        <Input
            id="fantasy-team-name"
            bind:value={teamName}
            disabled={readOnly}
            maxlength={40}
            placeholder="Name your squad" />
    </div>

    <SquadSummary
        {picks}
        {squadSize}
        {budget}
        {cost}
        {priceOf}
        {readOnly}
        onremove={togglePick}
        onpreview={() => (showPreview = true)} />

    {#if !readOnly}
        <div class="mb-2 flex gap-2">
            <Button
                color="primary"
                size="sm"
                class="flex-1"
                disabled={!canSave}
                onclick={saveSquad}>
                {fantasy?.myEntry ? 'Update Squad' : 'Enter Squad'}
            </Button>
            {#if fantasy?.myEntry}
                <Button
                    color="light"
                    size="sm"
                    disabled={saving}
                    onclick={withdrawSquad}>
                    Withdraw
                </Button>
            {/if}
        </div>
    {/if}

    <PlayerMarket
        {market}
        {picks}
        {remaining}
        squadFull={squadComplete}
        {readOnly}
        onpick={togglePick} />
{/if}

<FantasyTeamModal
    bind:open={showPreview}
    teamName={teamName || 'My Squad'}
    ownerName={fantasy?.myEntry?.ownerName}
    players={previewPlayers}
    playerStats={previewStats}
    {cost}
    points={fantasy?.myEntry?.points ?? null}
    onclose={() => (showPreview = false)} />
