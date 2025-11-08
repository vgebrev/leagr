<script>
    import SlideCard from './SlideCard.svelte';

    let { data } = $props();
</script>

<SlideCard
    icon="📊"
    heading="Year by Numbers"
    description={`${data?.firstSession} to ${data?.lastSession}`}>
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div class="rounded-lg bg-blue-50 p-4 text-center md:p-6 dark:bg-blue-900/20">
            <div
                class="mb-1 text-3xl font-bold text-blue-600 md:mb-2 md:text-5xl dark:text-blue-400">
                {data?.totalSessions || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                Sessions
            </div>
        </div>

        <div class="rounded-lg bg-green-50 p-4 text-center md:p-6 dark:bg-green-900/20">
            <div
                class="mb-1 text-3xl font-bold text-green-600 md:mb-2 md:text-5xl dark:text-green-400">
                {data?.totalMatches || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                Matches
            </div>
        </div>

        <div class="rounded-lg bg-purple-50 p-4 text-center md:p-6 dark:bg-purple-900/20">
            <div
                class="mb-1 text-3xl font-bold text-purple-600 md:mb-2 md:text-5xl dark:text-purple-400">
                {data?.totalPlayers || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                Players
            </div>
        </div>

        <div class="rounded-lg bg-orange-50 p-4 text-center md:p-6 dark:bg-orange-900/20">
            <div
                class="mb-1 text-3xl font-bold text-orange-600 md:mb-2 md:text-5xl dark:text-orange-400">
                {data?.totalGoals || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                Goals
            </div>
        </div>
    </div>
</SlideCard>
