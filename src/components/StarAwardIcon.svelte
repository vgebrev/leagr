<script>
    import { StarSolid } from 'flowbite-svelte-icons';
    import SoccerBootIcon from '#components/Icons/SoccerBootIcon.svelte';
    import BullseyeIcon from '#components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '#components/Icons/ShieldIcon.svelte';
    import GloveIcon from '#components/Icons/GloveIcon.svelte';

    /**
     * The glyph for one Stars of the Day award - the same five the session board, the
     * Ballers Board and the news feed use for these awards.
     * @type {{ award: BallerAwardType, class?: string }}
     */
    let { award, class: className = '' } = $props();

    /** @type {Record<BallerAwardType, import('svelte').Component<any>>} */
    const ICONS = {
        mvp: StarSolid,
        goldenBoot: SoccerBootIcon,
        playmaker: BullseyeIcon,
        brickWall: ShieldIcon,
        goldenGlove: GloveIcon
    };

    const Icon = $derived(ICONS[award]);
</script>

<Icon class={className} />
