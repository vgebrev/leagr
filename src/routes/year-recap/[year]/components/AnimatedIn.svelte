<script>
    import { fade, scale, fly } from 'svelte/transition';
    import { onMount } from 'svelte';

    let { children, delay = 0, type = 'fade', duration = 500, ...transitionProps } = $props();

    let show = $state(false);

    onMount(() => {
        const timer = setTimeout(() => {
            show = true;
        }, delay);

        return () => clearTimeout(timer);
    });

    // Map transition types to functions
    const transitions = {
        fade,
        scale,
        fly
    };

    const transitionFn = transitions[type] || fade;
</script>

{#if show}
    <div in:transitionFn={{ duration, ...transitionProps }}>
        {@render children()}
    </div>
{/if}
