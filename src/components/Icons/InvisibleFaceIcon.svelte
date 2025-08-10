<script>
    let { class: className = 'w-5 h-5', ...restProps } = $props();
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 400"
    class={className}
    style="fill: currentColor;"
    {...restProps}>
    <!-- Face circle (dotted outline to indicate invisibility) -->
    <circle
        cx="200"
        cy="200"
        r="160"
        fill="none"
        stroke="currentColor"
        stroke-width="32"
        stroke-dasharray="80,60" />

    <!-- Left eye (solid, larger) -->
    <circle
        cx="150"
        cy="160"
        r="32"
        fill="currentColor" />

    <!-- Right eye (solid, larger) -->
    <circle
        cx="250"
        cy="160"
        r="32"
        fill="currentColor" />

    <!-- Mouth (straight line) -->
    <line
        x1="150"
        y1="260"
        x2="250"
        y2="260"
        stroke="currentColor"
        stroke-width="32"
        stroke-linecap="round" />
</svg>
