<script>
    import { resolve } from '$app/paths';

    const RECAP_YEAR = '2025';
</script>

<a
    href={resolve(`/year-recap/[year]`, { year: RECAP_YEAR })}
    class="year-recap-bounce fixed right-4 bottom-18 flex aspect-square w-1/2 max-w-[200px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 p-4 text-center shadow-lg transition-transform hover:scale-105 dark:border-blue-400 dark:from-blue-900 dark:to-purple-900">
    <div class="text-4xl">🎉</div>
    <p class="text-sm font-semibold text-gray-900 dark:text-white">
        {RECAP_YEAR} Recap is here!
    </p>
    <span class="text-xs text-blue-600 dark:text-blue-400">Check it out!</span>
</a>

<style>
    @keyframes gentle-bounce {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-10px);
        }
    }

    .year-recap-bounce {
        animation: gentle-bounce 2s ease-in-out infinite;
    }

    .year-recap-bounce:hover {
        animation-play-state: paused;
    }
</style>
