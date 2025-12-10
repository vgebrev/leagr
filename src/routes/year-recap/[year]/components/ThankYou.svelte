<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';

    let { initialDelay = 400, duration = 400 } = $props();
</script>

<SlideCard
    icon="🙌"
    heading="Thank You"
    description="">
    <div class="mt-8 text-center">
        <AnimatedIn
            delay={initialDelay}
            type="fade"
            {duration}>
            <p class="text-base leading-relaxed text-gray-700 md:text-lg dark:text-gray-300">
                Thank you for an incredible year of football, banter, and unforgettable moments.
            </p>
        </AnimatedIn>

        <AnimatedIn
            delay={initialDelay + 400}
            type="fade"
            {duration}>
            <p class="mt-6 text-base leading-relaxed text-gray-700 md:text-lg dark:text-gray-300">
                Here's to many more days on the pitch together.
            </p>
        </AnimatedIn>

        <AnimatedIn
            delay={initialDelay + 800}
            type="fade"
            {duration}>
            <p class="mt-8 text-xl font-semibold text-gray-900 md:text-2xl dark:text-white">
                See you next year! ⚽
            </p>
        </AnimatedIn>
    </div>
</SlideCard>
