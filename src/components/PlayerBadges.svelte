<script>
    import { Badge } from 'flowbite-svelte';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import DangerManIcon from '$components/Icons/DangerManIcon.svelte';
    import EngineIcon from '$components/Icons/EngineIcon.svelte';
    import TowerIcon from '$components/Icons/TowerIcon.svelte';
    import UtilityHeroIcon from '$components/Icons/UtilityHeroIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';

    /** @type {{ traits?: object, playerProfile?: string[] }} */
    let { traits = {}, playerProfile = [] } = $props();

    // Individual trait badges — bronze (amber-600)
    const TRAIT_BADGES = [
        { key: 'isFinisher', label: 'Finisher', Icon: LeagueIcon, iconProps: { icon: 'soccer' } },
        { key: 'isAttacker', label: 'Attacker', Icon: BullseyeIcon, iconProps: {} },
        { key: 'isDefender', label: 'Defender', Icon: ShieldIcon, iconProps: {} },
        { key: 'isShotStopper', label: 'Shot Stopper', Icon: GloveIcon, iconProps: {} }
    ];

    // Combo badge config — 2-trait: silver (slate-400), 3+: gold (yellow-500)
    const COMBO_CONFIG = {
        'Danger Man': { Icon: DangerManIcon, tier: 'silver' },
        Engine: { Icon: EngineIcon, tier: 'silver' },
        Sentinel: { Icon: TowerIcon, tier: 'silver' },
        'Utility Hero': { Icon: UtilityHeroIcon, tier: 'silver' },
        'Complete Player': { Icon: CrownIcon, tier: 'gold' },
        'G.O.A.T.': { Icon: TrophyIcon, tier: 'gold' }
    };

    const bronzeClass =
        'border-amber-600 bg-transparent text-amber-700 dark:border-amber-500 dark:text-amber-400';
    const silverClass =
        'border-slate-400 bg-transparent text-slate-500 dark:border-slate-400 dark:text-slate-300';
    const goldClass =
        'border-yellow-500 bg-transparent text-yellow-600 dark:border-yellow-400 dark:text-yellow-300';

    let activeTraits = $derived(TRAIT_BADGES.filter((t) => traits?.[t.key]));
    let allCombos = $derived(
        playerProfile.map((name) => ({ name, ...COMBO_CONFIG[name] })).filter((b) => b.Icon)
    );
    let silverBadges = $derived(allCombos.filter((b) => b.tier === 'silver'));
    let goldBadges = $derived(allCombos.filter((b) => b.tier === 'gold'));
</script>

{#if activeTraits.length > 0 || allCombos.length > 0}
    <div class="mt-1 flex flex-wrap gap-1">
        {#each activeTraits as { label, Icon, iconProps } (label)}
            <Badge
                border
                class="flex items-center gap-1 {bronzeClass}">
                <Icon
                    class="h-4 w-4"
                    {...iconProps} />
                <span class="text-sm">{label}</span>
            </Badge>
        {/each}
        {#each silverBadges as { name, Icon } (name)}
            <Badge
                border
                class="flex items-center gap-1 {silverClass}">
                <Icon class="h-4 w-4" />
                <span class="text-sm">{name}</span>
            </Badge>
        {/each}
        {#each goldBadges as { name, Icon } (name)}
            <Badge
                border
                class="flex items-center gap-1 {goldClass}">
                <Icon class="h-4 w-4" />
                <span class="text-sm">{name}</span>
            </Badge>
        {/each}
    </div>
{/if}
