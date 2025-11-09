<script>
    let { children, icon, heading, description } = $props();
</script>

<div class="relative flex h-full w-full overflow-hidden">
    <!-- Background decorative elements -->
    <div
        class="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-primary-400/20 blur-3xl md:h-64 md:w-64 dark:bg-primary-600/20"></div>
    <div
        class="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-blue-400/15 blur-3xl md:h-56 md:w-56 dark:bg-blue-600/15"></div>
    <div
        class="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-purple-400/15 blur-3xl md:h-56 md:w-56 dark:bg-purple-600/15"></div>

    <div
        class="glass relative z-10 flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
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
