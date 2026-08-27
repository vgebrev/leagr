<script>
    import { AngleRightOutline } from 'flowbite-svelte-icons';
    import { resolve } from '$app/paths';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    // The index of everything under /help. A topic is declared here rather than discovered
    // from the filesystem, because a help page needs a name and a sentence a router cannot
    // supply — but it means a new /help/* route has to be added to this list to be findable.
    // Routes are kept as literals and passed to `resolve` at the href, which is both what
    // the lint rule looks for and what lets SvelteKit's typed routes catch a dead link here
    // rather than in the browser.
    // No icon per topic: a glyph is an identity in this app, and the obvious candidates are
    // already spoken for elsewhere (the medal is the Rankings tab). A topic gets one when a
    // glyph exists that means only that topic.
    const TOPICS = /** @type {const} */ ([
        {
            route: '/help/badges',
            title: 'Badges',
            blurb: 'Every badge in the game, the four traits behind them, and what it takes to earn one.'
        }
    ]);

    $effect(() => {
        titleParts.set(['Help']);
        return () => titleParts.set([]);
    });
</script>

<!-- Header -->
<div class="mb-2 flex items-start justify-between">
    <div>
        <h5 class="flex items-center text-lg font-bold">Help</h5>
        <p class="text-sm text-gray-400">How the parts of the game work</p>
    </div>
</div>

<ul class="flex flex-col gap-3">
    {#each TOPICS as topic (topic.route)}
        <li>
            <!-- The whole card is the link, so the tap target is the card on a phone rather
                 than the title text. Block, not flex, on the anchor: the flex row is inside,
                 so the focus ring follows the card's rounded edge. -->
            <a
                href={resolve(topic.route)}
                class="glass block rounded-lg border border-gray-200 p-3 hover:border-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-hidden dark:border-gray-700 dark:hover:border-gray-600">
                <div class="flex items-center gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="text-base font-bold">{topic.title}</div>
                        <p class="text-sm text-gray-500 dark:text-gray-400">{topic.blurb}</p>
                    </div>
                    <AngleRightOutline class="h-4 w-4 shrink-0 text-gray-400" />
                </div>
            </a>
        </li>
    {/each}
</ul>
