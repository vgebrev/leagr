<script>
    import { Listgroup, ListgroupItem } from 'flowbite-svelte';
    import MatchCard from '$components/MatchCard.svelte';

    let {
        schedule = [],
        teams = {},
        onMatchUpdate,
        onTeamClick,
        disabled = false,
        className = ''
    } = $props();
</script>

{#if schedule.length > 0}
    <div class={`flex w-full flex-col gap-2 ${className}`}>
        {#each schedule as round, roundIndex (roundIndex)}
            <Listgroup class="glass w-full">
                <ListgroupItem class="px-2.5 py-1 dark:text-gray-300">
                    Round {roundIndex + 1}
                </ListgroupItem>

                {#each round as match, matchIndex (matchIndex)}
                    {#if !match.bye}
                        <ListgroupItem class="p-0">
                            <MatchCard
                                {match}
                                matchId={`r${roundIndex}-m${matchIndex}`}
                                {teams}
                                orientation="horizontal"
                                {disabled}
                                {onTeamClick}
                                onUpdate={(/** @type {any} */ updatedMatch) =>
                                    onMatchUpdate?.(roundIndex, matchIndex, updatedMatch)}
                                className="w-full" />
                        </ListgroupItem>
                    {/if}
                {/each}
            </Listgroup>
        {/each}
    </div>
{/if}
