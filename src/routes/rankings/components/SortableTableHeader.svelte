<script>
    import { TableHeadCell } from 'flowbite-svelte';

    let { column, label, currentSort, onSort, className = 'px-1 py-1.5 text-center' } = $props();

    let isActive = $derived(currentSort === column);
    let cellClass = $derived(
        `cursor-default ${className} ${isActive ? 'font-bold text-black dark:text-white' : ''}`
    );
</script>

<TableHeadCell class={cellClass}>
    <span
        role="button"
        aria-label="Sort by {label}"
        tabindex="0"
        onkeydown={() => onSort(column)}
        onclick={() => onSort(column)}>
        {label}
    </span>
</TableHeadCell>
