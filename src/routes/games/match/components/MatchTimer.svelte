<script>
    import { Button } from 'flowbite-svelte';
    import {
        PlaySolid,
        PauseSolid,
        RefreshOutline,
        VolumeUpSolid,
        VolumeMuteSolid,
        MinusOutline,
        PlusOutline
    } from 'flowbite-svelte-icons';
    import { matchTimer, formatClock } from '$lib/client/services/matchTimer.svelte.js';

    /**
     * @typedef {Object} MatchTimerProps
     * @property {boolean} [disabled] - Locks every control once the competition day has ended
     */

    /** @type {MatchTimerProps} */
    let { disabled = false } = $props();

    let clock = $derived(formatClock(matchTimer.remainingMs));
    let counting = $derived(matchTimer.status === 'countdown');
    let finished = $derived(matchTimer.status === 'finished');

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

    let clockColour = $derived(
        finished
            ? 'text-red-600 dark:text-red-500'
            : matchTimer.isLastPlay
              ? 'text-amber-500 dark:text-amber-400'
              : matchTimer.remainingMs <= 10_000 && matchTimer.isRunning
                ? 'text-red-600 dark:text-red-500'
                : matchTimer.remainingMs <= 60_000 && matchTimer.isRunning
                  ? 'text-amber-500 dark:text-amber-400'
                  : ''
    );

    let barColour = $derived(
        finished || (matchTimer.remainingMs <= 10_000 && matchTimer.isRunning)
            ? 'bg-red-500'
            : matchTimer.isLastPlay
              ? 'bg-amber-500'
              : 'bg-primary-600 dark:bg-primary-500'
    );

    function handlePrimary() {
        if (matchTimer.isLastPlay) {
            matchTimer.endLastPlay();
        } else if (matchTimer.status === 'idle') {
            matchTimer.start();
        } else if (matchTimer.status === 'running') {
            matchTimer.pause();
        } else if (matchTimer.status === 'paused') {
            matchTimer.resume();
        }
    }
</script>

<div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
    <!-- Duration + mute -->
    <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1">
            <Button
                size="xs"
                color="alternative"
                class="!p-1.5"
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
                class="!p-1.5"
                disabled={disabled || matchTimer.durationMinutes >= 60}
                onclick={() => matchTimer.adjustDuration(1)}
                aria-label="Increase game length">
                <PlusOutline class="h-3 w-3" />
            </Button>
        </div>
        <Button
            size="xs"
            color="alternative"
            class="!p-1.5"
            onclick={() => matchTimer.toggleMute()}
            aria-label={matchTimer.muted ? 'Unmute whistle' : 'Mute whistle'}>
            {#if matchTimer.muted}
                <VolumeMuteSolid class="h-4 w-4" />
            {:else}
                <VolumeUpSolid class="h-4 w-4" />
            {/if}
        </Button>
    </div>

    <!-- Clock -->
    <div
        class="flex flex-col items-center gap-1"
        role="timer"
        aria-label="Match timer">
        {#if matchTimer.isLastPlay}
            <span
                class="text-xs font-bold tracking-widest text-amber-500 uppercase motion-safe:animate-pulse dark:text-amber-400">
                Last Play
            </span>
        {:else if finished}
            <span
                class="text-xs font-bold tracking-widest text-red-600 uppercase dark:text-red-500">
                Full Time
            </span>
        {/if}

        {#if counting}
            <span
                class="text-primary-600 dark:text-primary-500 font-mono text-4xl font-bold tabular-nums motion-safe:animate-ping">
                {matchTimer.countdownValue}
            </span>
        {:else}
            <span class="font-mono text-4xl font-bold tabular-nums {clockColour}">{clock}</span>
        {/if}

        <div class="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
                class="h-full rounded-full transition-[width] duration-200 ease-linear {barColour}"
                style="width: {matchTimer.progress * 100}%">
            </div>
        </div>

        <span
            class="sr-only"
            aria-live="polite">{announcement}</span>
    </div>

    <!-- Controls -->
    <div class="mt-2 flex items-center justify-center gap-2">
        <Button
            size="sm"
            color={matchTimer.isLastPlay ? 'red' : 'primary'}
            disabled={disabled || counting || finished}
            onclick={handlePrimary}>
            {#if matchTimer.isLastPlay}
                End Play
            {:else if matchTimer.status === 'running'}
                <PauseSolid class="me-2 h-3 w-3" /> Pause
            {:else if matchTimer.status === 'paused'}
                <PlaySolid class="me-2 h-3 w-3" /> Resume
            {:else}
                <PlaySolid class="me-2 h-3 w-3" /> Start
            {/if}
        </Button>
        {#if matchTimer.isActive}
            <Button
                size="sm"
                color="alternative"
                disabled={disabled || counting}
                onclick={() => matchTimer.reset()}>
                <RefreshOutline class="me-2 h-3 w-3" /> Reset
            </Button>
        {/if}
    </div>
</div>
