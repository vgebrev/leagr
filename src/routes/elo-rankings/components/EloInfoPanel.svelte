<script>
    import { Card } from 'flowbite-svelte';
    import { Badge } from 'flowbite-svelte';

    let { rankings } = $props();

    function formatDate(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    <Card>
        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">System Overview</h3>

        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Total Players</span>
                <Badge color="blue">{rankings.metadata?.totalPlayers || 0}</Badge>
            </div>

            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Average Rating</span>
                <Badge color="green">{rankings.metadata?.averageRating || 1000}</Badge>
            </div>

            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Average Seed Score</span>
                <Badge color="blue">{rankings.metadata?.averageSeedScore || 1000}</Badge>
            </div>

            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Processed Sessions</span>
                <Badge color="purple">{rankings.metadata?.processedSessionsCount || 0}</Badge>
            </div>

            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(rankings.metadata?.lastUpdated)}
                </span>
            </div>
        </div>
    </Card>

    <Card>
        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">How Elo Works</h3>

        <div class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div>
                <p class="font-medium text-gray-900 dark:text-white">Rating System:</p>
                <p>
                    Players start at 1000. Ratings increase with wins and decrease with losses based
                    on expected vs actual performance.
                </p>
            </div>

            <div>
                <p class="font-medium text-gray-900 dark:text-white">Seed Score:</p>
                <p>
                    Primary ranking metric that adjusts Elo rating based on activity. Inactive
                    players are heavily penalized.
                </p>
            </div>

            <div>
                <p class="font-medium text-gray-900 dark:text-white">Activity Gate:</p>
                <p>
                    Seed score = min rating + (attendance % of max player) × (rating - min rating). Inactive players pulled toward worst performer.
                </p>
            </div>

            <div>
                <p class="font-medium text-gray-900 dark:text-white">Rating Decay:</p>
                <p>Elo ratings decay 2% per week toward 1000.</p>
            </div>

            <div>
                <p class="font-medium text-gray-900 dark:text-white">K-Factors:</p>
                <p>League: 10 points, Cup: 7 points per game.</p>
            </div>
        </div>
    </Card>

    <Card>
        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Rating Levels</h3>

        <div class="space-y-2">
            <div class="flex items-center space-x-2">
                <Badge color="purple">1200+</Badge>
                <span class="text-sm text-gray-600 dark:text-gray-400">Expert</span>
            </div>
            <div class="flex items-center space-x-2">
                <Badge color="blue">1100-1199</Badge>
                <span class="text-sm text-gray-600 dark:text-gray-400">Advanced</span>
            </div>
            <div class="flex items-center space-x-2">
                <Badge color="green">1000-1099</Badge>
                <span class="text-sm text-gray-600 dark:text-gray-400">Average</span>
            </div>
            <div class="flex items-center space-x-2">
                <Badge color="yellow">900-999</Badge>
                <span class="text-sm text-gray-600 dark:text-gray-400">Developing</span>
            </div>
            <div class="flex items-center space-x-2">
                <Badge color="red">Below 900</Badge>
                <span class="text-sm text-gray-600 dark:text-gray-400">Beginner</span>
            </div>
        </div>
    </Card>
</div>
