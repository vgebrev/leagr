<script>
    import { Listgroup, ListgroupItem } from 'flowbite-svelte';
    import MatchCard from '$components/MatchCard.svelte';
    import { resolve } from '$app/paths';
    import { ClipboardListOutline } from 'flowbite-svelte-icons';

    let {
        schedule = [],
        teams = {},
        date = '',
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
                            <div class="flex w-full items-start">
                                <MatchCard
                                    {match}
                                    matchId={`r${roundIndex}-m${matchIndex}`}
                                    {teams}
                                    orientation="horizontal"
                                    {disabled}
                                    {onTeamClick}
                                    onUpdate={(/** @type {any} */ updatedMatch) =>
                                        onMatchUpdate?.(roundIndex, matchIndex, updatedMatch)}
                                    className="min-w-0 flex-1" />
                                {#if date}
                                    <a
                                        href={resolve(`/games/match?date=${date}&competition=league&round=${roundIndex + 1}&match=${matchIndex + 1}`, {})}                                        class="shrink-0 ps-0 pe-1 pt-2 text-gray-400 hover:text-gray-200"
                                        aria-label="Open match tracker"
                                        title="Track this match">
                                        <ClipboardListOutline class="h-6 w-6" />
                                    </a>
                                {/if}
                            </div>
                        </ListgroupItem>
                    {/if}
                {/each}
            </Listgroup>
        {/each}
    </div>
{/if}
