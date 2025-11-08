<script>
    let { children, icon, heading, description } = $props();
</script>

<div class="flex h-full w-full">
    <div
        class="glass flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <!-- Header section - fixed at top -->
        <div class="shrink-0 px-4 py-6 text-center md:px-6 md:py-8">
            <div class="mb-2 text-4xl md:mb-4 md:text-6xl">{icon}</div>
            <h2 class="mb-1 text-2xl font-bold text-gray-900 md:mb-2 md:text-4xl dark:text-white">
                {heading}
            </h2>
            <p class="text-sm text-gray-600 md:text-base dark:text-gray-400">{description}</p>
        </div>

        <!-- Content section - scrollable -->
        <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-12 md:px-6">
            {@render children()}
        </div>
    </div>
</div>
