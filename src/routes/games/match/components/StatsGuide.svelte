<script>
    import {
        CheckOutline,
        BanOutline,
        ChevronRightOutline,
        InfoCircleOutline
    } from 'flowbite-svelte-icons';
    import { slide } from 'svelte/transition';

    let open = $state(false);

    const sections = [
        {
            title: 'Attack',
            note: null,
            awarded: [
                'Assisting a goal',
                'Shots on target',
                'Shots off target from a reasonable goalscoring position',
                'Key passes creating a clear goalscoring chance',
                'Notable skill/dribble beating at least 2 players'
            ],
            notAwarded: ['Wild shots off target', 'Goals']
        },
        {
            title: 'Defence',
            note: 'keepers eligible outside the box',
            awarded: [
                'Tackles/blocks/interceptions resulting in change of possession',
                'Blocking a shot on target',
                'Clearing the ball off the line'
            ],
            notAwarded: [
                'Tackles resulting in a foul',
                'Unforced errors resulting in change of possession'
            ]
        },
        {
            title: 'Saves',
            note: 'keepers only',
            awarded: [
                'Stopping a shot on target',
                'Intercepting/blocking a dangerous ball in the box'
            ],
            notAwarded: ['Stopping a shot off target']
        }
    ];
</script>

<div class="glass w-full rounded-lg border border-gray-200 p-2 py-1 dark:border-gray-700">
    <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-1.5 py-1 text-sm font-medium select-none dark:text-white"
        onclick={() => (open = !open)}>
        <ChevronRightOutline
            class="h-5 w-5 text-gray-400 transition-transform duration-200 dark:text-gray-500 {open
                ? 'rotate-90'
                : ''}" />
        <InfoCircleOutline />
        <span class="pt-0.5">Stats Guide</span>
    </button>

    {#if open}
        <div
            class="flex flex-col gap-3 border-t border-gray-200 pt-2 dark:border-gray-700"
            transition:slide={{ duration: 200 }}>
            {#each sections as section (section.title)}
                <div>
                    <p class="mb-1 text-sm font-semibold dark:text-white">
                        {section.title}{#if section.note}<span
                                class="ml-1 font-normal text-gray-500 dark:text-gray-400"
                                >({section.note})</span
                            >{/if}
                    </p>
                    <ul class="flex flex-col gap-1">
                        {#each section.awarded as item (item)}
                            <li class="flex items-start gap-1.5 text-sm">
                                <CheckOutline
                                    class="mt-px h-3 w-3 shrink-0 text-green-500 dark:text-green-400" />
                                {item}
                            </li>
                        {/each}
                        {#each section.notAwarded as item (item)}
                            <li
                                class="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                                <BanOutline
                                    class="mt-px h-3 w-3 shrink-0 text-red-400 dark:text-red-500" />
                                {item}
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
            <p class="pb-1 text-sm italic">
                Be generous - more stats, even if not completely accurate, give more information
                than missing stats.
            </p>
        </div>
    {/if}
</div>
