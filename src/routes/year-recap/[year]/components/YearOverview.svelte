<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';

    let { data } = $props();
</script>

<SlideCard
    icon="📊"
    heading="Year by Numbers"
    description={`${data?.firstSession} to ${data?.lastSession}`}>
    <div class="flex items-center justify-center">
        <div class="grid grid-cols-2 gap-3 md:gap-4">
            <AnimatedIn delay={0} type="scale" duration={400}>
                <div class="glass rounded-lg border border-gray-200 bg-gray-700 p-4 text-center md:p-6 dark:border-gray-700 dark:bg-gray-700">
                    <div
                        class="mb-1 text-3xl font-bold text-primary-700 md:mb-2 md:text-5xl dark:text-primary-600">
                        {data?.totalSessions || 0}
                    </div>
                    <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                        Sessions
                    </div>
                </div>
            </AnimatedIn>

            <AnimatedIn delay={200} type="scale" duration={400}>
                <div class="glass rounded-lg border border-gray-200 bg-gray-700 p-4 text-center md:p-6 dark:border-gray-700 dark:bg-gray-700">
                    <div
                        class="mb-1 text-3xl font-bold text-primary-700 md:mb-2 md:text-5xl dark:text-primary-600">
                        {data?.totalMatches || 0}
                    </div>
                    <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                        Matches
                    </div>
                </div>
            </AnimatedIn>

            <AnimatedIn delay={400} type="scale" duration={400}>
                <div class="glass rounded-lg border border-gray-200 bg-gray-700 p-4 text-center md:p-6 dark:border-gray-700 dark:bg-gray-700">
                    <div
                        class="mb-1 text-3xl font-bold text-primary-700 md:mb-2 md:text-5xl dark:text-primary-600">
                        {data?.totalPlayers || 0}
                    </div>
                    <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                        Players
                    </div>
                </div>
            </AnimatedIn>

            <AnimatedIn delay={600} type="scale" duration={400}>
                <div class="glass rounded-lg border border-gray-200 bg-gray-700 p-4 text-center md:p-6 dark:border-gray-700 dark:bg-gray-700">
                    <div
                        class="mb-1 text-3xl font-bold text-primary-700 md:mb-2 md:text-5xl dark:text-primary-600">
                        {data?.totalGoals || 0}
                    </div>
                    <div class="text-sm font-medium text-gray-700 md:text-base dark:text-gray-300">
                        Goals
                    </div>
                </div>
            </AnimatedIn>
        </div>
    </div>
</SlideCard>
