<script>
    let { class: className = 'w-5 h-5', ...restProps } = $props();
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    class={className}
    style="fill: currentColor;"
    {...restProps}>
    <path
        d="M256 0c-70.7 0-128 62.7-128 140 0 66.3 42.1 121.8 98.7 136.2l-15.4 187.4C209.7 485.9 230.4 512 256 512s46.3-26.1 44.7-48.4l-15.4-187.4C341.9 261.8 384 206.3 384 140 384 62.7 326.7 0 256 0z" />
</svg>
