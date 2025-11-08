<script>
    import SlideCard from './SlideCard.svelte';

    let { data } = $props();
</script>

<SlideCard
    icon="📊"
    heading="Year by Numbers"
    description={`${data?.firstSession} to ${data?.lastSession}`}>
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div class="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20 md:p-6">
            <div class="mb-1 text-3xl font-bold text-blue-600 dark:text-blue-400 md:mb-2 md:text-5xl">
                {data?.totalSessions || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-base">
                Sessions
            </div>
        </div>

        <div class="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20 md:p-6">
            <div class="mb-1 text-3xl font-bold text-green-600 dark:text-green-400 md:mb-2 md:text-5xl">
                {data?.totalMatches || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-base">
                Matches
            </div>
        </div>

        <div class="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-900/20 md:p-6">
            <div class="mb-1 text-3xl font-bold text-purple-600 dark:text-purple-400 md:mb-2 md:text-5xl">
                {data?.totalPlayers || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-base">
                Players
            </div>
        </div>

        <div class="rounded-lg bg-orange-50 p-4 text-center dark:bg-orange-900/20 md:p-6">
            <div class="mb-1 text-3xl font-bold text-orange-600 dark:text-orange-400 md:mb-2 md:text-5xl">
                {data?.totalGoals || 0}
            </div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-base">
                Goals
            </div>
        </div>
    </div>
</SlideCard>
