<script>
    import { Popover } from 'flowbite-svelte';
    import BadgeChip from '$components/BadgeChip.svelte';
    import {
        normaliseTraitTiers,
        displayBadges,
        explainBadge,
        gradeLabel,
        TRAIT_DEFS
    } from '$lib/shared/badges.js';

    /** @type {{ traits?: Record<string, boolean>, traitTiers?: Record<string, number>, idPrefix?: string }} */
    let { traits = {}, traitTiers = {}, idPrefix = 'badge' } = $props();

    // Popovers are wired by element id, so ids must survive two PlayerBadges on one page.
    const uid = Math.random().toString(36).slice(2, 8);
    const baseId = $derived(`${idPrefix.replace(/[^a-zA-Z0-9_-]/g, '-')}-${uid}`);

    // Badges are derived from the persisted tiers rather than from the persisted badge
    // list, so a rankings file written before the lattice changed still renders under
    // today's rules instead of under its own stale vocabulary.
    let badges = $derived(displayBadges(normaliseTraitTiers(traits, traitTiers)));

    const TRAIT_LABELS = Object.fromEntries(TRAIT_DEFS.map((t) => [t.key, t.label]));
</script>

{#if badges.length > 0}
    <div class="mt-1 flex flex-wrap justify-center gap-1 space-y-1 space-x-1">
        {#each badges as badge (badge.id)}
            {@const triggerId = `${baseId}-${badge.id}`}
            <BadgeChip
                {badge}
                id={triggerId}
                interactive />
            <Popover
                triggeredBy="#{triggerId}"
                placement="top"
                class="max-w-64 text-sm"
                arrow={false}>
                <div class="font-semibold">{badge.label}</div>
                <div class="text-xs opacity-70">{gradeLabel(badge)}</div>
                <div class="mt-1 text-xs">{explainBadge(badge)}</div>
                <!-- Only count-based badges gain anything here: an archetype's requirement
                     already names its two traits, but "any 3+" does not say which three. -->
                {#if badge.requiresCount}
                    <div class="mt-0.5 text-xs opacity-70">
                        From {badge.contributingTraits.map((k) => TRAIT_LABELS[k]).join(', ')}
                    </div>
                {/if}
            </Popover>
        {/each}
    </div>
{/if}
