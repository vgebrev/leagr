<script>
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import DangerManIcon from '$components/Icons/DangerManIcon.svelte';
    import CrosshairIcon from '$components/Icons/CrosshairIcon.svelte';
    import EngineIcon from '$components/Icons/EngineIcon.svelte';
    import TowerIcon from '$components/Icons/TowerIcon.svelte';
    import UtilityHeroIcon from '$components/Icons/UtilityHeroIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';

    /**
     * One badge, rendered. This is the whole visual grammar of the lattice and the only
     * place it exists — a player's earned badges and the badges help page render the same
     * component, so the catalogue on the help page cannot show a badge that looks unlike
     * the one a player actually wears.
     *
     * `interactive` is what a popover trigger needs (focusable, role, help cursor). The
     * help page lists badges as content rather than as controls, so it leaves it off.
     *
     * @type {{
     *   badge: import('$lib/shared/badges.js').BadgeDef,
     *   id?: string,
     *   interactive?: boolean
     * }}
     */
    let { badge, id = undefined, interactive = false } = $props();

    // Icon = badge identity, which is shared only where the NAME is shared. Trait pills are
    // "Finisher"/"Elite Finisher" — one identity at two levels — so they share a glyph, as do
    // the Breadth/Mastery pairs that answer the same question ("3+" and "all 4"). Archetype
    // upgrades are named as separate identities (Danger Man → Sniper), and supersession means
    // a player never displays both, so a shared glyph buys a side-by-side reading the UI
    // never renders while costing a channel that helps scan a row. Sniper is the first to
    // take its own; the other three still inherit.
    /** @type {Record<string, { Icon: import('svelte').Component<any>, iconProps: object }>} */
    const ICONS = {
        finisher: { Icon: LeagueIcon, iconProps: { icon: 'soccer' } },
        'elite-finisher': { Icon: LeagueIcon, iconProps: { icon: 'soccer' } },
        attacker: { Icon: BullseyeIcon, iconProps: {} },
        'elite-attacker': { Icon: BullseyeIcon, iconProps: {} },
        defender: { Icon: ShieldIcon, iconProps: {} },
        'elite-defender': { Icon: ShieldIcon, iconProps: {} },
        'shot-stopper': { Icon: GloveIcon, iconProps: {} },
        'elite-shot-stopper': { Icon: GloveIcon, iconProps: {} },
        'danger-man': { Icon: DangerManIcon, iconProps: {} },
        sniper: { Icon: CrosshairIcon, iconProps: {} },
        engine: { Icon: EngineIcon, iconProps: {} },
        powerhouse: { Icon: EngineIcon, iconProps: {} },
        sentinel: { Icon: TowerIcon, iconProps: {} },
        guardian: { Icon: TowerIcon, iconProps: {} },
        'utility-hero': { Icon: UtilityHeroIcon, iconProps: {} },
        maverick: { Icon: UtilityHeroIcon, iconProps: {} },
        'all-rounder': { Icon: CrownIcon, iconProps: {} },
        'true-baller': { Icon: TrophyIcon, iconProps: {} },
        'complete-player': { Icon: CrownIcon, iconProps: {} },
        goat: { Icon: TrophyIcon, iconProps: {} }
    };

    // shape = badge.shape. Traits and archetypes follow their category; the multi-trait
    // badges follow their requirement — "3+" is notched, "all four" is faceted — which is
    // why the catalogue declares a shape rather than deriving one.
    /** @type {Record<string, { outer: string, inner: string }>} */
    const SHAPES = {
        pill: { outer: 'badge-pill', inner: 'badge-pill-inner px-2.5' },
        rounded: { outer: 'badge-rounded', inner: 'badge-rounded-inner px-2.5' },
        notched: { outer: 'badge-notched', inner: 'badge-notched-inner px-3' },
        faceted: { outer: 'badge-faceted', inner: 'badge-faceted-inner px-4' }
    };

    // material = tier. EDGES is the 1px rim on the outer element.
    //
    // Both stops are the SAME Tailwind step, varying only in hue. Tailwind 4's scales are
    // oklch-based, so a shared step means shared lightness — which is the point: a
    // light-to-dark ramp reads as a bevel, and on a wide badge it makes the top edge look
    // thicker than the bottom (the bottom sits at the dark end and recedes into the
    // background) even though the geometry is symmetric to the pixel. Keep any replacement
    // pair on one step.
    //
    // Bronze sits on the orange ramp and gold on the yellow one — roughly 30 degrees of hue
    // apart, where the amber/yellow pair they started as read as the same colour at badge
    // size. Gold stays the lighter of the two so the tiers separate on lightness as well.
    /** @type {Record<string, string>} */
    const EDGES = {
        bronze: 'bg-gradient-to-br from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-300',
        silver: 'bg-gradient-to-br from-slate-500 to-gray-500 dark:from-slate-300 dark:to-gray-300',
        gold: 'bg-gradient-to-br from-yellow-500 to-amber-500 dark:from-yellow-300 dark:to-amber-300',
        diamond:
            'bg-gradient-to-br from-cyan-500 to-violet-500 dark:from-cyan-300 dark:to-violet-300'
    };

    // Outlined variant: the inner layer paints the page surface, not a tint, so only the
    // 1px rim shows. It cannot simply be transparent — the edge gradient sits directly
    // behind it and would bleed through the whole badge. That does mean the surface is
    // assumed rather than inherited; if a badge is ever placed on a panel that is not the
    // page background, this is the line to revisit.
    const SURFACE = 'bg-gray-50 dark:bg-gray-800';

    // Label and icon carry the tier colour, since the fill no longer does.
    /** @type {Record<string, string>} */
    const INKS = {
        bronze: 'text-orange-700 dark:text-orange-300',
        silver: 'text-slate-600 dark:text-slate-300',
        gold: 'text-yellow-700 dark:text-yellow-300',
        diamond: 'text-cyan-700 dark:text-cyan-300'
    };

    const { Icon, iconProps } = $derived(ICONS[badge.id]);
    const shape = $derived(SHAPES[badge.shape]);
    const outerClass = $derived(`inline-flex p-px ${shape.outer} ${EDGES[badge.tier]}`);
</script>

{#snippet face()}
    <!-- The label never wraps: the notched and faceted silhouettes cut their corners at a
         fixed pixel depth, so a two-line badge takes the same bite out of a taller box and
         stops reading as the same shape. -->
    <span
        class="flex items-center justify-center gap-0.5 py-0.5 text-xs font-medium whitespace-nowrap sm:gap-1 sm:text-sm
            {shape.inner} {SURFACE} {INKS[badge.tier]}">
        <Icon
            class="h-4 w-4 shrink-0"
            {...iconProps} />
        <span>{badge.label}</span>
    </span>
{/snippet}

<!-- Two branches rather than conditional attributes: a span carrying tabindex without a
     matching role is an a11y error, and Svelte can only see that the pair is consistent
     when both are literals. -->
{#if interactive}
    <span
        {id}
        tabindex="0"
        role="button"
        class="{outerClass} cursor-help">
        {@render face()}
    </span>
{:else}
    <span
        {id}
        class={outerClass}>
        {@render face()}
    </span>
{/if}
