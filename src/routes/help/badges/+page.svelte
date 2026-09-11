<script>
    import BadgeChip from '$components/BadgeChip.svelte';
    import {
        BADGE_DEFS,
        BADGES_BY_ID,
        TRAIT_DEFS,
        TIER_ORDER,
        SHAPE_ORDER,
        bandPercent,
        explainBadge,
        gradeLabel,
        BASE_PERCENTILE,
        ELITE_PERCENTILE,
        eliteBandFor,
        TRAIT_SEASON_GAMES_THRESHOLD,
        TRAIT_MIN_TRACKED_SESSIONS
    } from '$lib/shared/badges.js';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    // The page is a rendering of the lattice, not a second copy of it: every badge, its
    // requirement, its grade and its supersessions come from badges.js, so a catalogue
    // change shows up here without anyone remembering to edit this file.
    //
    // A section can draw on more than one category. Breadth and Mastery share one, because
    // the split between them is an implementation detail of the lattice — a reader sees four
    // badges answering the same question ("how many, and how good?"), and the grade line
    // already names which is which.
    const SECTIONS = [
        {
            categories: ['trait'],
            title: 'Traits',
            blurb: 'One badge per area of the game. Reaching the Elite band upgrades the badge rather than adding one.'
        },
        {
            categories: ['archetype'],
            title: 'Archetypes',
            blurb: 'Named combinations of two traits. Six pairs are possible; four are recognised.'
        },
        {
            categories: ['breadth', 'mastery'],
            title: 'Versatility & Mastery',
            blurb: 'Awarded for how many traits you hold, not which ones. Three earns Versatility, all four earns Mastery — and holding them at the Elite band makes either one rare.',
            groupByShape: true
        }
    ];

    /**
     * Shape first, then material — so each silhouette's two badges sit together: All-Rounder
     * above Complete Player, True Baller above G.O.A.T.
     *
     * Only the multi-trait section asks for this. Traits and Archetypes are authored in
     * base-then-Elite pairs already, and sorting them this way would pull those pairs apart
     * into a block of base badges above a block of Elite ones.
     */
    const byShapeThenTier = (/** @type {any} */ a, /** @type {any} */ b) =>
        SHAPE_ORDER.indexOf(a.shape) - SHAPE_ORDER.indexOf(b.shape) ||
        TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);

    // Sorted rather than listed by id: a badge added to one of these categories later still
    // appears, placed by its own shape and tier instead of silently going missing.
    const badgesIn = (/** @type {any} */ section) => {
        const badges = BADGE_DEFS.filter((b) => section.categories.includes(b.category));
        return section.groupByShape ? [...badges].sort(byShapeThenTier) : badges;
    };

    /** Materials in the order they rank, for the legend. */
    const MATERIALS = {
        bronze: 'A trait you hold',
        silver: 'A pair of traits',
        gold: 'An Elite trait, an Elite pair, or three traits',
        diamond: 'Three or more Elite traits'
    };

    /** One representative badge per material, so the legend shows real chips. */
    const MATERIAL_SAMPLES = {
        bronze: 'finisher',
        silver: 'engine',
        gold: 'elite-attacker',
        diamond: 'goat'
    };

    /** @param {{ supersedes?: string|string[] }} badge */
    const supersededBy = (badge) =>
        (badge.supersedes ? [badge.supersedes].flat() : []).map((id) => BADGES_BY_ID[id].label);

    $effect(() => {
        titleParts.set(['Badges', 'Help']);
        return () => titleParts.set([]);
    });
</script>

<!-- Header -->
<div class="mb-2 flex items-start justify-between">
    <div>
        <h5 class="flex items-center text-lg font-bold">Badges</h5>
        <p class="text-sm text-gray-400">Every badge in the game and what it takes to earn one</p>
    </div>
</div>

<div class="flex flex-col gap-3">
    <!-- How traits are earned -->
    <section class="glass rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <h6 class="mb-2 text-base font-bold">How traits are earned</h6>
        <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
            Badges are built from four traits, each measured on one stat and averaged per session
            rather than totalled, so simply playing more games earns you nothing on its own. Shot
            Stopper is the one that also counts your season total, because how much of the keeping
            you do is the largest part of what makes someone the team's shot stopper.
        </p>
        <!-- Badge and description are direct children of one grid rather than rows of their
             own, so the first column sizes to the widest badge across the whole list and the
             descriptions line up down it. A description that needs two lines wraps inside its
             column instead of dropping under the badge, which is what makes this readable on
             a phone. `dl` rather than `ul` because that is the shape of the content, and
             because `dt`/`dd` are already the grid's children — putting an `li` in between
             would need `display: contents`, which costs the list its a11y semantics.
             The `dt` is a flex box so its height is the chip's height exactly: as a plain
             block it sits the inline-flex chip on a text baseline, leaving descender space
             below it that throws the row's vertical centring off by a couple of pixels. -->
        <dl class="mb-3 grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-1 text-sm">
            {#each TRAIT_DEFS as trait (trait.key)}
                <dt class="flex items-center"><BadgeChip badge={BADGES_BY_ID[trait.id]} /></dt>
                <dd class="min-w-0 text-gray-500 dark:text-gray-400">{trait.stat}</dd>
            {/each}
        </dl>
        <h6 class="mt-4 mb-1 text-sm font-bold">Before a trait can be awarded</h6>
        <p class="text-sm text-gray-500 dark:text-gray-400">
            You need at least <strong>{TRAIT_SEASON_GAMES_THRESHOLD} games this season</strong>
            (roughly five sessions — the same bar the team generator uses), and at least
            <strong>{TRAIT_MIN_TRACKED_SESSIONS} sessions of the stat itself</strong>. The second
            one matters when a league starts recording a stat mid-season: attendance from before it
            was tracked does not count toward proving yourself at it. Shot Stopper reads that as {TRAIT_MIN_TRACKED_SESSIONS}
            sessions in goal — turning up is enough to be measured, but only time in goal proves the role.
        </p>
        <h6 class="mt-4 mb-1 text-sm font-bold">Where the bar sits</h6>
        <p class="text-sm text-gray-500 dark:text-gray-400">
            Everyone who clears those gates is ranked against each other on each stat, and the two
            bands are read off that live distribution:
            <strong>Top {bandPercent(BASE_PERCENTILE)}%</strong> earns the trait, and
            <strong>Top {bandPercent(ELITE_PERCENTILE)}%</strong> makes it Elite. The bands are recalculated
            every time rankings are, so they track the league as it changes — and only players past the
            gates set them, so newcomers cannot drag the bar around.
        </p>
        {#each TRAIT_DEFS.filter((t) => t.elitePercentile) as trait (trait.key)}
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <strong>{trait.label}</strong> is the exception: Elite is
                <strong>Top {bandPercent(eliteBandFor(trait.key))}%</strong> there. Far fewer players
                ever keep goal, so its pool is roughly half the size of the others — on a flat bar it
                would hand out half as many Elite badges as the rest for no reason to do with the standard.
            </p>
        {/each}
    </section>

    <!-- Material legend -->
    <section class="glass rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <h6 class="mb-2 text-base font-bold">Reading a badge</h6>
        <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
            A badge carries two independent facts. Its <strong>shape</strong> says how many traits
            it takes — pills are one, rounded are two, and the notched and faceted shapes are the
            multi-trait badges. Its <strong>colour</strong> says how hard it was:
        </p>
        <dl class="grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-1 text-sm">
            {#each TIER_ORDER as material (material)}
                <dt class="flex items-center">
                    <BadgeChip badge={BADGES_BY_ID[MATERIAL_SAMPLES[material]]} />
                </dt>
                <dd class="min-w-0 text-gray-500 dark:text-gray-400">{MATERIALS[material]}</dd>
            {/each}
        </dl>
    </section>

    <!-- The catalogue -->
    {#each SECTIONS as section (section.title)}
        <section class="glass rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <h6 class="text-base font-bold">{section.title}</h6>
            <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">{section.blurb}</p>
            <dl class="grid grid-cols-[max-content_1fr] items-center gap-1">
                {#each badgesIn(section) as badge (badge.id)}
                    {@const replaces = supersededBy(badge)}
                    <dt class="flex items-center"><BadgeChip {badge} /></dt>
                    <dd class="min-w-0 text-sm">
                        <div>{explainBadge(badge)}</div>
                        <!-- Built as one string rather than markup: Svelte collapses the
                             whitespace either side of a block tag, which eats the space
                             before the separator. -->
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                            {gradeLabel(badge)}{replaces.length
                                ? ` · replaces ${replaces.join(' and ')}`
                                : ''}
                        </div>
                    </dd>
                {/each}
            </dl>
        </section>
    {/each}

    <!-- Why some badges disappear -->
    <section class="glass rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <h6 class="mb-2 text-base font-bold">Why you don't see them all at once</h6>
        <p class="text-sm text-gray-500 dark:text-gray-400">
            A badge is hidden when another badge you hold already guarantees it — an Elite Finisher
            is a Finisher, so only the Elite pill is shown. Nothing is taken away: you still qualify
            for the badge underneath, it just adds nothing next to the one above it. Badges that do
            not imply each other are both kept, which is why a player can wear
            {BADGES_BY_ID['true-baller'].label} and {BADGES_BY_ID['complete-player'].label} side by side.
        </p>
    </section>
</div>
