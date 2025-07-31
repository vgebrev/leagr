<script>
    import confetti from 'canvas-confetti';
    import { teamStyles } from '$lib/shared/helpers.js';
    import { fade } from 'svelte/transition';

    /**
     * @typedef {Object} Props
     * @property {string} teamName
     * @property {import('$lib/shared/helpers.js').TeamColour} teamColour
     * @property {boolean} [celebrating]
     * @property {string} [icon]
     * @property {string[] | null} [confettiColours]
     */

    /** @type {Props} */
    let {
        teamName,
        teamColour,
        celebrating = $bindable(),
        icon = '🏆',
        confettiColours = null
    } = $props();

    export function shootStars() {
        const defaults = {
            spread: 360,
            ticks: 50,
            gravity: 0.9,
            decay: 0.94,
            startVelocity: 30,
            colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8']
        };

        function shoot() {
            confetti({
                ...defaults,
                particleCount: 40,
                scalar: 1.2,
                shapes: ['star']
            });

            confetti({
                ...defaults,
                particleCount: 80,
                scalar: 0.75,
                shapes: ['circle']
            });
        }

        setTimeout(shoot, 0);
        setTimeout(shoot, 200);
        setTimeout(shoot, 400);
        setTimeout(shoot, 600);
        setTimeout(shoot, 800);
    }

    /**
     * @param {string[]} teamColours - Array of hex colour strings for confetti
     */
    export function fireConfetti(teamColours) {
        const end = Date.now() + 0.5 * 1000;

        const colors = confettiColours || teamColours || ['#999999', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 70,
                spread: 55,
                origin: { x: 0, y: 0.66 },
                colors: colors
            });
            confetti({
                particleCount: 2,
                angle: 110,
                spread: 55,
                origin: { x: 1, y: 0.66 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        })();
    }

    /** @type {number | NodeJS.Timeout | null} */
    let celebrationTimeout = null;
    function celebrate() {
        if (celebrationTimeout) clearTimeout(celebrationTimeout);
        shootStars();
        fireConfetti(teamStyles[teamColour]?.confetti ?? teamStyles.default.confetti);
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
