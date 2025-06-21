<script>
    import { Button } from 'flowbite-svelte';
    import { ExclamationCircleSolid, ArrowLeftOutline } from 'flowbite-svelte-icons';
    import { capitalize, teamColours, teamStyles } from '$lib/helpers.js';

    let {
        team,
        teamIndex = null,
        color = null,
        teamName,
        onremove = null,
        onfillempty = null,
        players
    } = $props();

    let teamColour = $derived(color || teamColours[teamIndex % teamColours.length]);

    const styles = $derived(teamStyles[teamColour] || teamStyles.default);
</script>

<div class="relative overflow-hidden rounded-md shadow-md">
    <table
        class={`w-full text-left text-sm rtl:text-right ${styles.text} border-collapse overflow-hidden rounded-md`}>
        <thead class={`text-xs uppercase ${styles.header}`}>
            <tr>
                <th
                    scope="col"
                    class="p-2">
                    {teamName || `${capitalize(teamColour)} Team`}
                </th>
            </tr>
        </thead>
        <tbody>
            {#each team as player, i (i)}
                <tr class={`${styles.row}`}>
                    <td class="m-0 p-2"
                        ><div class="flex">
                            {#if player && players.includes(player)}
                                <span>{player}</span>
                            {:else if player && !players.includes(player)}
                                <span class="flex gap-2 line-through"
                                    ><ExclamationCircleSolid />{player}</span>
                            {:else}
                                <span class="flex gap-2 italic"
                                    ><ExclamationCircleSolid /> Empty</span>
                            {/if}
                            {#if onremove && player}
                                <Button
                                    size="sm"
                                    class="ms-auto p-0"
                                    type="button"
                                    outline={true}
                                    pill={true}
                                    color={styles.button}
                                    onclick={() => onremove({ player, teamIndex })}
                                    ><svg
                                        class="h-4 w-4"
                                        fill="currentColor"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 20 20"
                                        ><path
                                            d="M10 10l5.09-5.09L10 10l5.09 5.09L10 10zm0 0L4.91 4.91 10 10l-5.09 5.09L10 10z"
                                            stroke="currentColor"
                                            fill="none"
                                            fill-rule="evenodd"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"></path
                                        ></svg
                                    ></Button
                                >{/if}
                            {#if onfillempty && !player}
                                <Button
                                    size="sm"
                                    class="ms-auto p-0"
                                    type="button"
                                    outline={true}
                                    pill={true}
                                    color={styles.button}
                                    onclick={() => onfillempty({ playerIndex: i, teamIndex })}
                                    ><ArrowLeftOutline class="h-4 w-4" /></Button
                                >{/if}
                        </div></td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
