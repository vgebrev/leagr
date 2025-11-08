<script>
    let { children } = $props();
</script>

<div class="flex h-full grow items-center justify-center">
    <div
        class="glass max-h-full w-full max-w-4xl overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
        <div class="space-y-6 p-6 text-center">
            {@render children()}
        </div>
    </div>
</div>
