<script>
    import { Button } from 'flowbite-svelte';
    import {
        PlaySolid,
        PauseSolid,
        StopSolid,
        RefreshOutline,
        VolumeUpSolid,
        VolumeMuteSolid,
        MinusOutline,
        PlusOutline,
        ChevronRightOutline
    } from 'flowbite-svelte-icons';
    import { slide } from 'svelte/transition';
    import { matchTimer, formatClock } from '$lib/client/services/matchTimer.svelte.js';

    /**
     * @typedef {Object} MatchTimerProps
     * @property {boolean} [disabled] - Locks every control once the competition day has ended
     * @property {(() => void)} [onKickOff] - Fired when the referee starts the clock
     */

    /** @type {MatchTimerProps} */
    let { disabled = false, onKickOff = undefined } = $props();

    let clock = $derived(formatClock(matchTimer.remainingMs));
    let counting = $derived(matchTimer.status === 'countdown');
    let finished = $derived(matchTimer.status === 'finished');

    let statusLabel = $derived(matchTimer.isLastPlay ? 'Last Play' : finished ? 'Full Time' : '');

    // One source of truth for the primary action, so the collapsed icon and the
    // labelled button can never drift apart on what the control does. It means
    // the same thing in every phase - last play gets its own button rather than
    // taking this one over, so nothing changes meaning under the referee's thumb
    // mid-match, and a game paused during last play can still be resumed.
    let primaryLabel = $derived(
        matchTimer.status === 'running'
            ? 'Pause'
            : matchTimer.status === 'paused'
              ? 'Resume'
              : 'Start'
    );
    let PrimaryIcon = $derived(matchTimer.status === 'running' ? PauseSolid : PlaySolid);
    let primaryDisabled = $derived(disabled || counting || finished);

    let showEndPlay = $derived(matchTimer.isLastPlay);

    // Announce at minute boundaries only - a per-second live region would flood
    // a screen reader for the whole match.
    let announcedMinutes = $derived(Math.ceil(matchTimer.remainingMs / 60_000));
    let announcement = $derived(
        finished
            ? 'Full time'
            : matchTimer.isLastPlay
              ? 'Last play'
              : matchTimer.status === 'running'
                ? `${announcedMinutes} minute${announcedMinutes === 1 ? '' : 's'} remaining`
                : ''
    );

    function handlePrimary() {
        if (matchTimer.status === 'idle') {
            matchTimer.start();
            onKickOff?.();
        } else if (matchTimer.status === 'running') {
            matchTimer.pause();
        } else if (matchTimer.status === 'paused') {
            matchTimer.resume();
        }
    }
</script>

<!-- The clock and its status label are rendered from these in both states, so
     they read identically whether tucked into the header row or laid out in
     full - only the size changes. -->
{#snippet clockFace(sizeClass)}
    {#if counting}
        <span class="font-mono {sizeClass} font-bold tabular-nums motion-safe:animate-ping">
            {matchTimer.countdownValue}
        </span>
    {:else}
        <span class="font-mono {sizeClass} font-bold tabular-nums">{clock}</span>
    {/if}
{/snippet}

{#snippet statusBadge()}
    {#if statusLabel}
        <span
            class="text-xs font-bold tracking-widest text-gray-600 uppercase dark:text-gray-400 {matchTimer.isLastPlay
                ? 'motion-safe:animate-pulse'
                : ''}">
            {statusLabel}
        </span>
    {/if}
{/snippet}

<div
    class="glass w-full rounded-lg border border-gray-200 p-2 dark:border-gray-700"
    role="timer"
    aria-label="Match timer">
    <!-- Header: the chevron and "Timer" hold their place across both states, so
         the panel keeps an anchor while everything else moves.
         Expanding is a view preference rather than a match write, so the toggle
         stays live once the competition has ended - as the mute button does. -->
    <!-- The toggle and the trailing group both take an equal share of the free
         space, which is what actually centres the clock in the panel rather
         than merely placing it between them. -->
    <div class="flex items-center gap-2">
        <button
            type="button"
            class="flex flex-1 cursor-pointer items-center gap-1.5 py-1 text-sm font-medium select-none dark:text-white"
            onclick={() => matchTimer.toggleExpanded()}
            aria-expanded={matchTimer.expanded}
            aria-label={matchTimer.expanded ? 'Hide timer controls' : 'Show timer controls'}>
            <ChevronRightOutline
                class="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500 {matchTimer.expanded
                    ? 'rotate-90'
                    : ''}" />
            <span class="pt-0.5">Timer</span>
        </button>

        <span
            class="sr-only"
            aria-live="polite">{announcement}</span>

        {#if !matchTimer.expanded}
            {@render clockFace('text-base')}
            <div class="flex flex-1 items-center justify-end gap-1.5">
                {@render statusBadge()}
                {#if showEndPlay}
                    <Button
                        size="xs"
                        outline
                        color="primary"
                        class="p-1.5!"
                        disabled={primaryDisabled}
                        onclick={() => matchTimer.endLastPlay()}
                        aria-label="End Play">
                        <StopSolid class="h-4 w-4" />
                    </Button>
                {/if}
                <Button
                    size="xs"
                    color="primary"
                    class="p-1.5!"
                    disabled={primaryDisabled}
                    onclick={handlePrimary}
                    aria-label={primaryLabel}>
                    <PrimaryIcon class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    </div>

    {#if matchTimer.expanded}
        <div
            class="mt-1 border-t border-gray-200 pt-2 dark:border-gray-700"
            transition:slide={{ duration: 200 }}>
            <!-- Duration, status, mute. Equal shares either side again, so the
                 badge sits centred despite the stepper being far wider. -->
            <div class="mb-2 flex items-center gap-2">
                <div class="flex flex-1 items-center gap-1">
                    <Button
                        size="xs"
                        color="alternative"
                        class="p-1.5!"
                        disabled={disabled || matchTimer.durationMinutes <= 1}
                        onclick={() => matchTimer.adjustDuration(-1)}
                        aria-label="Decrease game length">
                        <MinusOutline class="h-3 w-3" />
                    </Button>
                    <span class="w-16 text-center text-sm text-gray-600 dark:text-gray-400">
                        {matchTimer.durationMinutes} min
                    </span>
                    <Button
                        size="xs"
                        color="alternative"
                        class="p-1.5!"
                        disabled={disabled || matchTimer.durationMinutes >= 60}
                        onclick={() => matchTimer.adjustDuration(1)}
                        aria-label="Increase game length">
                        <PlusOutline class="h-3 w-3" />
                    </Button>
                </div>

                {@render statusBadge()}

                <div class="flex flex-1 justify-end">
                    <Button
                        size="xs"
                        color="alternative"
                        class="p-1.5!"
                        onclick={() => matchTimer.toggleMute()}
                        aria-label={matchTimer.muted ? 'Unmute whistle' : 'Mute whistle'}>
                        {#if matchTimer.muted}
                            <VolumeMuteSolid class="h-4 w-4" />
                        {:else}
                            <VolumeUpSolid class="h-4 w-4" />
                        {/if}
                    </Button>
                </div>
            </div>

            <!-- Clock -->
            <div class="flex flex-col items-center gap-1">
                {@render clockFace('text-2xl')}

                <div class="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                        class="bg-primary-600 dark:bg-primary-500 h-full rounded-full transition-[width] duration-200 ease-linear"
                        style="width: {matchTimer.progress * 100}%">
                    </div>
                </div>
            </div>

            <!-- Controls. End Play joins the row for last play rather than
                 replacing the primary, which keeps pause reachable throughout. -->
            <div class="mt-2 flex items-center justify-around gap-2">
                {#if showEndPlay}
                    <Button
                        size="xs"
                        outline
                        color="primary"
                        disabled={primaryDisabled}
                        onclick={() => matchTimer.endLastPlay()}>
                        <StopSolid class="me-2 h-3 w-3" /> End Play
                    </Button>
                {/if}

                <Button
                    size="xs"
                    color="primary"
                    disabled={primaryDisabled}
                    onclick={handlePrimary}>
                    <PrimaryIcon class="me-2 h-3 w-3" />
                    {primaryLabel}
                </Button>

                <Button
                    size="xs"
                    color="alternative"
                    disabled={disabled || counting}
                    onclick={() => matchTimer.reset()}>
                    <RefreshOutline class="me-2 h-3 w-3" /> Reset
                </Button>
            </div>
        </div>
    {/if}
</div>
