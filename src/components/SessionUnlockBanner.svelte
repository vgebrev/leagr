<script>
    /**
     * Admin-only control for editing a session after its competition end time.
     *
     * Only rendered for admins on a session that has already closed. Unlocking is
     * deliberately explicit and in-memory: a reload re-locks, so a forgotten toggle
     * can never quietly rewrite a completed session.
     */
    import { Alert, Button } from 'flowbite-svelte';
    import { LockSolid, LockOpenSolid } from 'flowbite-svelte-icons';
    import { settings } from '$lib/client/stores/settings.js';
    import { isCompetitionEnded } from '$lib/shared/helpers.js';
    import { hasAdminCode } from '$lib/client/services/api-client.svelte.js';
    import { sessionUnlock } from '$lib/client/services/sessionUnlock.svelte.js';

    let { date } = $props();

    let isAdmin = $derived(hasAdminCode());
    let competitionEnded = $derived(isCompetitionEnded(date, $settings));
    let unlocked = $derived(sessionUnlock.isUnlocked(date));
</script>

{#if isAdmin && competitionEnded}
    <Alert class="glass flex flex-wrap items-center gap-2 border py-2">
        {#if unlocked}
            <LockOpenSolid class="shrink-0" />
            <span class="flex-1 text-sm">
                Session unlocked for edits. Changes affect a completed session — re-run
                <strong>Update Rankings</strong> when you're done.
            </span>
            <Button
                size="xs"
                color="alternative"
                onclick={() => sessionUnlock.lock()}>
                <LockSolid class="me-2 h-4 w-4" /> Re-lock
            </Button>
        {:else}
            <LockSolid class="shrink-0" />
            <span class="flex-1 text-sm">This session is closed and read-only.</span>
            <Button
                size="xs"
                onclick={() => sessionUnlock.unlock(date)}>
                <LockOpenSolid class="me-2 h-4 w-4" /> Unlock to edit
            </Button>
        {/if}
    </Alert>
{/if}
