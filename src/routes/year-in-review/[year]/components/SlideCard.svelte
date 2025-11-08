<script>
    let { children, icon, heading, description } = $props();
</script>

<div class="flex h-full grow">
    <div class="inset-0 flex h-full w-full">
        <div
            class="glass max-h-full w-full overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
            <div class="space-y-6 p-6 text-center">
                <div class="mb-8">
                    <div class="mb-4 text-6xl">{icon}</div>
                    <h2 class="mb-2 text-4xl font-bold text-gray-900 dark:text-white">{heading}</h2>
                    <p class="text-gray-600 dark:text-gray-400">{description}</p>
                </div>

                {@render children()}
            </div>
        </div>
    </div>
</div>
