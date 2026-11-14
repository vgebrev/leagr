<script>
    import StarAwardIcon from '#components/StarAwardIcon.svelte';
    import { STAR_AWARD_LABELS } from '#lib/shared/starAwards.js';

    /**
     * A Stars of the Day award as a gold-outlined chip: the archetype badges' rounded
     * shape (`badge-rounded`), in the gold tier's ink.
     * A plain border rather than BadgeChip's gradient rim: that rim needs an opaque
     * page-coloured interior, and these chips sit on glass cards and inside popovers.
     * @type {{ award: BallerAwardType }}
     */
    let { award } = $props();
</script>

<span
    data-award={award}
    class="badge-rounded inline-flex items-center gap-1 border border-yellow-500 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-yellow-700 dark:border-yellow-300 dark:text-yellow-300">
    <StarAwardIcon
        {award}
        class="h-3 w-3 shrink-0" />
    {STAR_AWARD_LABELS[award]}
</span>
