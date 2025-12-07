<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import { teamStyles } from '$lib/shared/helpers.js';

    let { data, initialDelay = 400, duration = 400 } = $props();

    const itemStagger = 150; // Delay increment per color
</script>

<SlideCard
    icon="🎨"
    heading="True Colours"
    description="Team Records by Colour">
    <div class="mt-4 space-y-2">
        {#if data && data.length > 0}
            {#each data as colorData, index (index)}
                {@const colorStyle = teamStyles[colorData.color] || teamStyles.default}
                <AnimatedIn
                    delay={initialDelay + index * itemStagger}
                    type="scale"
                    {duration}>
                    <div
                        class="flex items-center justify-between rounded-lg border px-2 py-1 {colorStyle.text} {colorStyle.border}">
                        <!-- Left: Color name with trophies and W/D/L -->
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-2">
                                <div class="text-base font-bold capitalize md:text-lg">
                                    {colorData.color}
                                </div>
                                {#if colorData.leagueWins > 0 || colorData.cupWins > 0}
                                    <div class="flex items-center gap-1">
                                        {#if colorData.leagueWins > 0}
                                            <div class="flex items-center gap-0.5">
                                                <CrownIcon class="h-3 w-3 md:h-3.5 md:w-3.5" />
                                                <span class="text-xs font-bold md:text-sm">
                                                    {colorData.leagueWins}
                                                </span>
                                            </div>
                                        {/if}
                                        {#if colorData.cupWins > 0}
                                            <div class="flex items-center gap-0.5">
                                                <TrophyIcon
                                                    type="cup"
                                                    class="h-3 w-3 md:h-3.5 md:w-3.5" />
                                                <span class="text-xs font-bold md:text-sm">
                                                    {colorData.cupWins}
                                                </span>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                            <!-- W/D/L Record -->
                            <div class="flex items-center gap-1 text-xs md:text-sm">
                                <span class="font-semibold">W</span>
                                <span class="font-bold">{colorData.wins}</span>
                                <span>•</span>
                                <span class="font-semibold">D</span>
                                <span class="font-bold">{colorData.draws}</span>
                                <span>•</span>
                                <span class="font-semibold">L</span>
                                <span class="font-bold">{colorData.losses}</span>
                            </div>
                        </div>

                        <!-- Right: Top 4 most capped players (2x2 grid) -->
                        {#if colorData.topPlayers && colorData.topPlayers.length > 0}
                            <div class="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                {#each colorData.topPlayers as player, idx (idx)}
                                    <div class="flex items-center gap-1">
                                        <div class="shrink-0 leading-[0] [&>div]:block">
                                            <Avatar
                                                avatarUrl={player.avatarUrl}
                                                size="xs"
                                                color={colorData.color} />
                                        </div>
                                        <div class="text-[10px] font-medium">
                                            {player.name}
                                            ({player.caps})
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </AnimatedIn>
            {/each}
        {:else}
            <div class="py-8 text-gray-500 dark:text-gray-400">No color data available</div>
        {/if}
    </div>
</SlideCard>
