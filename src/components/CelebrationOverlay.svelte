<script>
    import ConfettiEffect from '$components/ConfettiEffect.svelte';
    import { teamStyles } from '$lib/shared/helpers.js';
    import { fade } from 'svelte/transition';

    /**
     * @typedef {Object} Props
     * @property {string} teamName
     * @property {import('$lib/shared/helpers.js').TeamColour} teamColour
     * @property {boolean} [celebrating]
     * @property {string} [icon]
     * @property {string[] | null} confettiColours]
     */

    /** @type {Props} */
    let {
        teamName,
        teamColour,
        celebrating = $bindable(),
        icon = '🏆',
        confettiColours = null
    } = $props();

    /** @type {ConfettiEffect | null} */
    let confettiEffect = null;

    /** @type {number | NodeJS.Timeout | null} */
    let celebrationTimeout = null;
    function celebrate() {
        if (celebrationTimeout) clearTimeout(celebrationTimeout);

        const colors =
            confettiColours || (teamStyles[teamColour]?.confetti ?? teamStyles.default.confetti);
        confettiEffect?.trigger(colors);

        celebrationTimeout = setTimeout(() => {
            celebrating = false;
        }, 3000);
    }

    $effect(() => {
        if (celebrating) {
            celebrate();
        }
        return () => {
            if (celebrationTimeout) clearTimeout(celebrationTimeout);
        };
    });
</script>

<ConfettiEffect bind:this={confettiEffect} />

{#if celebrating}
    <div
        class="pointer-events-none fixed inset-0 z-50 flex scale-100 items-center justify-center opacity-100 transition-all duration-1000"
        in:fade={{ duration: 300 }}
        out:fade={{ duration: 500 }}>
        <div
            class="rounded-xl px-8 py-6 text-center text-4xl font-bold shadow-lg {teamStyles[
                teamColour
            ]?.text ?? teamStyles.default.text} pulse-and-shake">
            {icon}
            <div class="mt-2 text-xl uppercase">{teamName}</div>
        </div>
    </div>
{/if}

<style>
    @keyframes pulse {
        0% {
            transform: scale(1);
        }
        40% {
            transform: scale(1.05);
        }
        100% {
            transform: scale(1);
        }
    }

    @keyframes shake {
        0% {
            transform: rotate(0deg);
        }
        15% {
            transform: rotate(-10deg);
        }
        30% {
            transform: rotate(10deg);
        }
        45% {
            transform: rotate(-6deg);
        }
        60% {
            transform: rotate(6deg);
        }
        75% {
            transform: rotate(-3deg);
        }
        90% {
            transform: rotate(3deg);
        }
        100% {
            transform: rotate(0deg);
        }
    }

    .pulse-and-shake {
        animation:
            pulse 1.5s ease-in-out infinite,
            shake 0.6s ease-in-out;
    }
</style>
