<script>
    import confetti from 'canvas-confetti';

    /**
     * @typedef {Object} Props
     * @property {string[] | null} [confettiColours] - Array of hex colour strings for confetti
     */

    /** @type {Props} */
    let { confettiColours = null } = $props();

    /**
     * Shoot star-shaped particles
     */
    function shootStars() {
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
     * Fire confetti from left and right sides
     * @param {string[] | null} [colors] - Optional array of hex colour strings for confetti
     */
    function fireConfetti(colors = null) {
        const end = Date.now() + 0.5 * 1000;

        const confettiColors = colors || confettiColours || ['#999999', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 70,
                spread: 55,
                origin: { x: 0, y: 0.66 },
                colors: confettiColors
            });
            confetti({
                particleCount: 2,
                angle: 110,
                spread: 55,
                origin: { x: 1, y: 0.66 },
                colors: confettiColors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        })();
    }

    /**
     * Trigger the confetti effect
     * @param {string[] | null} [colors] - Optional array of hex colour strings for confetti
     */
    export function trigger(colors = null) {
        shootStars();
        fireConfetti(colors);
    }
</script>
