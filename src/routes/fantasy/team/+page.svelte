<script>
    import { Alert, Button, Drawer, Input, Label, Spinner } from 'flowbite-svelte';
    import { ArrowLeftOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { resolve } from '$app/paths';
    import PlayerMarket from '../components/PlayerMarket.svelte';
    import SquadSummary from '../components/SquadSummary.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    let { data } = $props();
    let date = $derived(data.date);

    /** @type {any} */
    let fantasy = $state(null);
    let error = $state(false);
    let teamName = $state('');
    /** @type {string[]} */
    let picks = $state([]);
    /** @type {string | null} */
    let captainPick = $state(null);
    let saving = $state(false);
    // The market is a sheet over the pitch rather than a list under it: the squad stays
    // the screen, and picking is something that happens to a slot on it.
    let marketOpen = $state(false);

    let market = $derived(fantasy?.market ?? []);
    let squadSize = $derived(fantasy?.squadSize ?? 5);
    let budget = $derived(fantasy?.budget ?? 0);
    let readOnly = $derived(fantasy?.windowState !== 'open');
    let marketReady = $derived(fantasy?.marketReady !== false);
    // The saved squad, re-priced against the market as it stands now. It can drift out of
    // budget as more players register, and an invalid squad is not scored.
    let savedInvalidReason = $derived(
        fantasy?.myEntry && !fantasy.myEntry.valid ? fantasy.myEntry.invalidReason : null
    );

    let priceOf = $derived(Object.fromEntries(market.map((entry) => [entry.playerName, entry])));
    let cost = $derived(
        Math.round(picks.reduce((sum, name) => sum + (priceOf[name]?.price ?? 0), 0) * 2) / 2
    );
    let remaining = $derived(Math.round((budget - cost) * 2) / 2);
    let squadComplete = $derived(picks.length === squadSize);
    // A disabled button that never says why is a dead end — a squad that is picked and
    // priced but still unnamed looks finished. One line, always visible, naming the single
    // next thing to fix, in the order the screen is filled in.
    let missingPicks = $derived(Math.max(0, squadSize - picks.length));
    let saveBlockedReason = $derived(
        !marketReady
            ? "The market isn't ready yet."
            : missingPicks > 0
              ? `Pick ${missingPicks} more player${missingPicks === 1 ? '' : 's'}.`
              : cost > budget
                ? `Your squad is ${Math.round((cost - budget) * 2) / 2} over the ${budget} budget.`
                : !teamName.trim()
                  ? 'Give your squad a name.'
                  : null
    );
    let canSave = $derived(!readOnly && !saving && !saveBlockedReason);

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
                // points stay null until the session is settled — the pitch says so.
                { price: priceOf[name]?.price ?? 0, points: priceOf[name]?.points ?? null }
            ])
        )
    );
    // Dropped from the live market, or flagged on a frozen one: either way they score
    // nothing, and the preview says so under the pitch.
    let withdrawnPicks = $derived(
        picks.filter((name) => !priceOf[name] || priceOf[name].withdrawn)
    );

    // The armband is free points, so no squad should go without one for want of noticing
    // it exists: the priciest pick wears it until the manager moves it, and it passes on
    // by itself when that player leaves the pitch.
    let defaultCaptain = $derived(
        picks.length
            ? [...picks].sort((a, b) => (priceOf[b]?.price ?? 0) - (priceOf[a]?.price ?? 0))[0]
            : null
    );
    let captain = $derived(
        captainPick && picks.includes(captainPick) ? captainPick : defaultCaptain
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
        captainPick = state.myEntry ? (state.myEntry.captain ?? null) : captainPick;
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

    /** @param {string} playerName */
    function pickFromMarket(playerName) {
        togglePick(playerName);
        // The pick that completes the squad is the last thing the market is needed for,
        // so hand the pitch back instead of leaving a sheet over a finished squad.
        if (picks.length === squadSize) marketOpen = false;
    }

    async function saveSquad() {
        saving = true;
        await withLoading(
            async () => {
                adopt(
                    await api.post('fantasy', date, {
                        teamName: teamName.trim(),
                        players: picks,
                        captain
                    })
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
                captainPick = null;
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
        {#if budget}
            <p class="text-sm text-gray-400">
                <span>Pick {squadSize} players for ${budget}m</span>
            </p>
        {/if}
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
    {:else if !marketReady}
        <Alert class="glass mb-2 flex items-center border">
            <ExclamationCircleSolid />
            <span>{fantasy?.marketNotice}</span>
        </Alert>
    {:else if savedInvalidReason}
        <Alert class="glass mb-2 flex items-center border">
            <ExclamationCircleSolid />
            <span>
                {savedInvalidReason} Adjust it before kick-off or it won't be scored.
            </span>
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

    {#if !readOnly}
        <div class="mb-2">
            <div class="flex gap-2">
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
            {#if saveBlockedReason}
                <p
                    class="text-primary-600 dark:text-primary-400 mt-1 flex items-center gap-1 text-xs">
                    <ExclamationCircleSolid class="h-3.5 w-3.5 shrink-0" />
                    {saveBlockedReason}
                </p>
            {/if}
        </div>
    {/if}

    <SquadSummary
        {budget}
        {cost}
        points={fantasy?.myEntry?.points ?? null}
        players={previewPlayers}
        playerStats={previewStats}
        withdrawnPlayers={withdrawnPicks}
        slots={squadSize}
        {captain}
        onselect={() => (marketOpen = true)}
        onremove={readOnly ? undefined : togglePick}
        oncaptain={readOnly ? undefined : (name) => (captainPick = name)} />

    <!-- The market, as a sheet over the pitch. The drawer's own max-h-none outranks a
         plain max-h-*, so the height cap has to be important or a long market runs off
         the bottom of the screen.

         The scroller carries its own height cap rather than growing into the sheet with
         flex-1. A bottom drawer is a height:auto flex container, and WebKit sizes such a
         container from its items' flex base size — which `flex-1 min-h-0` makes zero — so
         on iOS (Safari *and* Chrome, both WebKit) the whole sheet collapsed to its padding
         and only the heading showed. Blink sizes it from the content instead, which is why
         it looked fine everywhere we tested. Keep the two caps in step: heading plus the
         drawer's own p-4 is the 6rem subtracted here, with slack for a heading that wraps. -->
    <Drawer
        bind:open={marketOpen}
        placement="bottom"
        class="glass-strong max-h-[85dvh]! rounded-t-xl border-gray-200">
        <div class="app-container">
            <div class="mb-2 flex items-baseline gap-2 pe-8">
                <h5 class="text-base font-bold dark:text-gray-300">Player market</h5>
                {#if !readOnly}
                    <!-- What is left to spend, worded so it does not read as a second copy
                         of the budget meter the sheet is covering. -->
                    <span class="text-xs dark:text-gray-400">
                        {remaining < 0
                            ? `$${Math.abs(remaining)}m over budget`
                            : `$${remaining}m to spend`}
                    </span>
                {/if}
            </div>
            <div class="max-h-[calc(85dvh-6rem)] overflow-y-auto">
                <PlayerMarket
                    {market}
                    {picks}
                    {remaining}
                    squadFull={squadComplete}
                    {readOnly}
                    onpick={pickFromMarket} />
            </div>
        </div>
    </Drawer>
{/if}
