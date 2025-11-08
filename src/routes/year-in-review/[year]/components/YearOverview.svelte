<script>
    import SlideCard from './SlideCard.svelte';

    let { data } = $props();
</script>

<SlideCard>
    <div class="mb-8">
        <div class="mb-4 text-6xl">📊</div>
        <h2 class="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Year by Numbers</h2>
        <p class="text-gray-600 dark:text-gray-400">
            {data?.firstSession} to {data?.lastSession}
        </p>
    </div>

    <div class="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        <div class="rounded-lg bg-blue-50 p-6 text-center dark:bg-blue-900/20">
            <div class="mb-2 text-5xl font-bold text-blue-600 dark:text-blue-400">
                {data?.totalSessions || 0}
            </div>
            <div class="font-medium text-gray-700 dark:text-gray-300">Sessions</div>
        </div>

        <div class="rounded-lg bg-green-50 p-6 text-center dark:bg-green-900/20">
            <div class="mb-2 text-5xl font-bold text-green-600 dark:text-green-400">
                {data?.totalMatches || 0}
            </div>
            <div class="font-medium text-gray-700 dark:text-gray-300">Matches</div>
        </div>

        <div class="rounded-lg bg-purple-50 p-6 text-center dark:bg-purple-900/20">
            <div class="mb-2 text-5xl font-bold text-purple-600 dark:text-purple-400">
                {data?.totalPlayers || 0}
            </div>
            <div class="font-medium text-gray-700 dark:text-gray-300">Players</div>
        </div>

        <div class="rounded-lg bg-orange-50 p-6 text-center dark:bg-orange-900/20">
            <div class="mb-2 text-5xl font-bold text-orange-600 dark:text-orange-400">
                {data?.totalGoals || 0}
            </div>
            <div class="font-medium text-gray-700 dark:text-gray-300">Goals</div>
        </div>
    </div>
</SlideCard>
