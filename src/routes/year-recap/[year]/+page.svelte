<script>
    import { isLoading, withLoading } from '$lib/client/stores/loading.js';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { Dropdown, DropdownItem, Button } from 'flowbite-svelte';
    import {
        ChevronDownOutline,
        ChevronLeftOutline,
        ChevronRightOutline,
        VolumeMuteSolid,
        VolumeUpSolid
    } from 'flowbite-svelte-icons';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { getYearOptions } from '$lib/shared/yearConfig.js';
    import { fly, fade } from 'svelte/transition';

    import YearOverview from './components/YearOverview.svelte';
    import IronManAward from './components/IronManAward.svelte';
    import MostImproved from './components/MostImproved.svelte';
    import KingOfKings from './components/KingOfKings.svelte';
    import PlayerOfYear from './components/PlayerOfYear.svelte';
    import Underdogs from './components/Underdogs.svelte';
    import Invincibles from './components/Invincibles.svelte';
    import TeamOfYear from './components/TeamOfYear.svelte';
    import FunFacts from './components/FunFacts.svelte';

    let { data } = $props();

    let yearRecap = $state(null);
    let yearDropdownOpen = $state(false);
    let currentSlide = $state(0);
    let lastLoadedYear = $state(null);
    let slideDirection = $state(1); // 1 for forward, -1 for backward
    let audioElement = $state(null);
    let isMuted = $state(true); // Muted by default

    // Touch/swipe tracking
    let touchStartX = $state(0);
    let touchEndX = $state(0);

    // Get selected year from URL parameter
    let selectedYear = $derived(parseInt(data.year, 10));

    // Generate year options from config
    let yearOptions = $derived(getYearOptions());

    // Total number of slides
    const totalSlides = 9;

    /**
     * Load year recap data for the selected year
     */
    async function loadYearRecap() {
        await withLoading(async () => {
            yearRecap = await api.get(`year-recap/${selectedYear}`);
        });
    }

    /**
     * Handle year selection
     */
    function handleYearChange(year) {
        goto(resolve(`/year-recap/${year}`, {}));
        yearDropdownOpen = false;
    }

    /**
     * Navigate to previous slide
     */
    function prevSlide() {
        slideDirection = -1;
        currentSlide = currentSlide === 0 ? totalSlides - 1 : currentSlide - 1;
    }

    /**
     * Navigate to next slide
     */
    function nextSlide() {
        slideDirection = 1;
        currentSlide = currentSlide === totalSlides - 1 ? 0 : currentSlide + 1;
    }

    /**
     * Go to specific slide
     */
    function goToSlide(index) {
        slideDirection = index > currentSlide ? 1 : -1;
        currentSlide = index;
    }

    /**
     * Toggle audio mute/unmute
     */
    function toggleAudio() {
        if (!audioElement) return;

        if (isMuted) {
            // Unmute and play
            audioElement.muted = false;
            audioElement.play().catch((err) => {
                console.error('Error playing audio:', err);
            });
            isMuted = false;
        } else {
            // Mute
            audioElement.muted = true;
            isMuted = true;
        }
    }

    /**
     * Handle touch start
     */
    function handleTouchStart(event) {
        touchStartX = event.touches[0].clientX;
    }

    /**
     * Handle touch end and detect swipe
     */
    function handleTouchEnd(event) {
        touchEndX = event.changedTouches[0].clientX;
        handleSwipe();
    }

    /**
     * Process swipe gesture
     */
    function handleSwipe() {
        const swipeThreshold = 50; // Minimum distance for a swipe
        const swipeDistance = touchStartX - touchEndX;

        if (Math.abs(swipeDistance) > swipeThreshold) {
            if (swipeDistance > 0) {
                // Swiped left - go to next slide
                nextSlide();
            } else {
                // Swiped right - go to previous slide
                prevSlide();
            }
        }
    }

    // Load data when component mounts or year changes
    $effect(() => {
        if (selectedYear && selectedYear !== lastLoadedYear) {
            lastLoadedYear = selectedYear;
            loadYearRecap();
            currentSlide = 0; // Reset to first slide on year change
        }
    });

    // Initialize audio when component mounts
    $effect(() => {
        if (audioElement && yearRecap) {
            // Start playing (muted by default)
            audioElement.play().catch((err) => {
                console.error('Error auto-playing audio:', err);
            });
        }
    });

    // Auto-slide every 10 seconds (resets on manual navigation)
    // $effect(() => {
    //     if (!yearRecap) return;
    //
    //     // Track currentSlide to reset interval on any slide change
    //     currentSlide;
    //
    //     const interval = setInterval(() => {
    //         nextSlide();
    //     }, 10000);
    //
    //     return () => clearInterval(interval);
    // });
</script>

<!-- Use min-h to ensure full viewport coverage minus navbars and padding -->
<div class="flex min-h-[calc(100dvh-9rem)] flex-col">
    <!-- Header with Year Selector -->
    <div class="mb-2 flex shrink-0 items-start justify-between">
        <div>
            <h5 class="text-lg font-bold">Year Recap</h5>
            <p class="text-sm text-gray-400">
                Highlights and statistics from {selectedYear}
            </p>
        </div>

        <!-- Year Selector -->
        <div class="flex items-center gap-1">
            <span class="text-xs">Year</span>
            <Button
                color="light"
                size="xs"
                class="flex items-center gap-1">
                {yearOptions.find((opt) => opt.value === selectedYear)?.name || selectedYear}
                <ChevronDownOutline class="h-4 w-4" />
            </Button>
            <Dropdown
                simple
                class="w-20 border border-gray-200 dark:border-gray-700 dark:bg-gray-800"
                bind:isOpen={yearDropdownOpen}>
                {#each yearOptions as option, i (i)}
                    <DropdownItem
                        onclick={() => handleYearChange(option.value)}
                        class={`w-full py-1 text-sm dark:bg-gray-800 dark:hover:bg-gray-700 ${
                            selectedYear === option.value
                                ? 'text-primary-600 w-full bg-gray-100 dark:bg-gray-700'
                                : ''
                        }`}>
                        {option.name}
                    </DropdownItem>
                {/each}
            </Dropdown>
        </div>
    </div>

    {#if $isLoading}
        <div class="flex flex-1 items-center justify-center">
            <div class="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
    {:else if yearRecap}
        <!-- Carousel Container with relative positioning for absolute children -->
        <div
            class="relative flex min-h-0 flex-1 flex-col"
            ontouchstart={handleTouchStart}
            ontouchend={handleTouchEnd}>
            <!-- Slides Container with absolute positioning for smooth transitions -->
            <div class="relative z-10 flex-1">
                {#key currentSlide}
                    <!-- Background decorative elements - fade during transitions to counter brightening -->
                    <div
                        class="bg-primary-400/20 dark:bg-primary-600/20 pointer-events-none absolute top-0 left-1/2 z-0 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl md:h-64 md:w-64"
                        in:fade={{ duration: 400 }}
                        out:fade={{ duration: 400 }}>
                    </div>
                    <div
                        class="pointer-events-none absolute bottom-16 left-0 z-0 h-40 w-40 rounded-full bg-blue-400/15 blur-3xl md:bottom-20 md:h-56 md:w-56 dark:bg-blue-600/15"
                        in:fade={{ duration: 400 }}
                        out:fade={{ duration: 400 }}>
                    </div>
                    <div
                        class="pointer-events-none absolute right-0 bottom-16 z-0 h-40 w-40 rounded-full bg-purple-400/15 blur-3xl md:bottom-20 md:h-56 md:w-56 dark:bg-purple-600/15"
                        in:fade={{ duration: 400 }}
                        out:fade={{ duration: 400 }}>
                    </div>

                    <div
                        class="glass-weak absolute inset-0 rounded-lg"
                        in:fly={{ x: slideDirection * 300, duration: 400 }}
                        out:fly={{ x: slideDirection * -300, duration: 400 }}>
                        {#if currentSlide === 0}
                            <YearOverview data={yearRecap.overview} />
                        {:else if currentSlide === 1}
                            <IronManAward data={yearRecap.ironManAward} />
                        {:else if currentSlide === 2}
                            <MostImproved data={yearRecap.mostImproved} />
                        {:else if currentSlide === 3}
                            <KingOfKings data={yearRecap.kingOfKings} />
                        {:else if currentSlide === 4}
                            <PlayerOfYear data={yearRecap.playerOfYear} />
                        {:else if currentSlide === 5}
                            <Underdogs data={yearRecap.underdogs} />
                        {:else if currentSlide === 6}
                            <Invincibles data={yearRecap.invincibles} />
                        {:else if currentSlide === 7}
                            <TeamOfYear data={yearRecap.teamOfYear} />
                        {:else if currentSlide === 8}
                            <FunFacts data={yearRecap.funFacts} />
                        {/if}
                    </div>
                {/key}
            </div>

            <!-- Navigation Buttons - positioned relative to carousel container -->
            <button
                onclick={prevSlide}
                class="glass-weak absolute top-7 left-2 z-10 -translate-y-1/2 rounded-full border border-gray-200 p-2 shadow-lg transition-all hover:scale-110 hover:bg-gray-50/20 hover:shadow-md hover:backdrop-blur-lg md:top-8 md:p-3 dark:border-gray-700 dark:hover:bg-gray-800/20"
                aria-label="Previous slide">
                <ChevronLeftOutline class="h-5 w-5 text-gray-900 md:h-6 md:w-6 dark:text-white" />
            </button>

            <button
                onclick={nextSlide}
                class="glass-weak absolute top-7 right-2 z-10 -translate-y-1/2 rounded-full border border-gray-200 p-2 shadow-lg transition-all hover:scale-110 hover:bg-gray-50/20 hover:shadow-md hover:backdrop-blur-lg md:top-8 md:p-3 dark:border-gray-700 dark:hover:bg-gray-800/20"
                aria-label="Next slide">
                <ChevronRightOutline class="h-5 w-5 text-gray-900 md:h-6 md:w-6 dark:text-white" />
            </button>

            <!-- Indicators - positioned relative to carousel container -->
            <div class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                <!-- eslint-disable-next-line no-unused-vars -->
                {#each Array(totalSlides) as _, index (index)}
                    <button
                        onclick={() => goToSlide(index)}
                        class="h-2 w-2 rounded-full transition-all {currentSlide === index
                            ? 'bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700 w-6'
                            : 'bg-gray-400/80 hover:bg-gray-500 dark:bg-gray-500/80 dark:hover:bg-gray-400'} backdrop-blur-sm"
                        aria-label="Go to slide {index + 1}"></button>
                {/each}
            </div>

            <!-- Audio Toggle Button - positioned in bottom right -->
            <button
                onclick={toggleAudio}
                class="glass absolute right-3 bottom-3 z-10 rounded-full border border-gray-200 p-3 shadow-lg transition-all hover:scale-110 hover:bg-gray-50/20 hover:shadow-md hover:backdrop-blur-lg md:p-3 dark:border-gray-700 dark:hover:bg-gray-800/20"
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}>
                {#if isMuted}
                    <VolumeMuteSolid class="h-5 w-5 text-gray-900 md:h-6 md:w-6 dark:text-white" />
                {:else}
                    <VolumeUpSolid class="h-5 w-5 text-gray-900 md:h-6 md:w-6 dark:text-white" />
                {/if}
            </button>
        </div>
    {:else}
        <div class="flex flex-1 items-center justify-center">
            <div class="text-gray-500 dark:text-gray-400">
                No data available for {selectedYear}
            </div>
        </div>
    {/if}

    <!-- Background Audio - dynamic based on selected year -->
    <audio
        bind:this={audioElement}
        src="/year-recap-{selectedYear}.mp3"
        loop
        muted={isMuted}
        preload="auto">
    </audio>
</div>
