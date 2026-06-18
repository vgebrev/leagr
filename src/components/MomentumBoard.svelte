<script>
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import {
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell
    } from 'flowbite-svelte';
    import { StarSolid } from 'flowbite-svelte-icons';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import DoubleTrophyIcon from '$components/Icons/DoubleTrophyIcon.svelte';
    import WoodenSpoonIcon from '$components/Icons/WoodenSpoonIcon.svelte';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import MomentumBar from '$components/MomentumBar.svelte';

    /**
     * @typedef {Object} MomentumEntry
     * @property {string} playerName
     * @property {number} value - signed momentum, -1 (cold) to 1 (hot)
     * @property {number} sessions
     * @property {boolean} provisional
     * @property {Record<string, number>} components - painted bar shares
     * @property {Array<{type: string, count: number}>} badges
     */

    /**
     * @type {{ entries: MomentumEntry[], variant: 'champions'|'ballers' }}
     */
    let { entries = [], variant = 'champions' } = $props();

    // Streak badge icons mirror the boards/Stars of the Day conventions
    /** @type {Record<string, {icon: import('svelte').Component<any>, color: string, label: string}>} */
    const badgeMeta = {
        double: {
            icon: DoubleTrophyIcon,
            color: 'text-amber-500',
            label: 'League & cup double streak'
        },
        league: { icon: CrownIcon, color: 'text-yellow-600', label: 'League title streak' },
        cup: { icon: TrophyIcon, color: 'text-amber-600', label: 'Cup win streak' },
        silverware: {
            icon: TrophyIcon,
            color: 'text-slate-400',
            label: 'Silverware streak (league or cup)'
        },
        woodenSpoon: {
            icon: WoodenSpoonIcon,
            color: 'text-amber-800',
            label: 'Wooden spoon streak (league last place)'
        },
        mvp: { icon: StarSolid, color: 'text-yellow-400', label: 'MVP streak' },
        goldenBoot: { icon: SoccerBootIcon, color: 'text-yellow-400', label: 'Golden Boot streak' },
        playmaker: { icon: BullseyeIcon, color: 'text-yellow-400', label: 'Playmaker streak' },
        brickWall: { icon: ShieldIcon, color: 'text-yellow-400', label: 'Brick Wall streak' },
        goldenGlove: { icon: GloveIcon, color: 'text-yellow-400', label: 'Golden Glove streak' }
    };

    // Painted bar sections per variant: hot and cold shades per component.
    // Presentational only - the momentum value is computed server-side.
    const segmentMeta = {
        champions: [
            { key: 'league', hot: 'bg-orange-500', cold: 'bg-blue-500', label: 'League' },
            { key: 'cup', hot: 'bg-amber-400', cold: 'bg-sky-400', label: 'Cup' }
        ],
        ballers: [
            { key: 'goals', hot: 'bg-orange-600', cold: 'bg-blue-600', label: 'Goals' },
            { key: 'attack', hot: 'bg-orange-500', cold: 'bg-blue-500', label: 'Attack' },
            { key: 'defence', hot: 'bg-orange-400', cold: 'bg-blue-400', label: 'Defence' },
            { key: 'saves', hot: 'bg-orange-300', cold: 'bg-blue-300', label: 'Saves' }
        ]
    };

    let hotCount = $derived(entries.filter((e) => e.value >= 0.1).length);
    let coldCount = $derived(entries.filter((e) => e.value <= -0.1).length);

    /** @param {MomentumEntry} entry */
    function segments(entry) {
        return segmentMeta[variant]
            .map((meta) => ({
                share: entry.components?.[meta.key] ?? 0,
                colorClass: entry.value < 0 ? meta.cold : meta.hot
            }))
            .filter((segment) => segment.share > 0);
    }

    /** @param {number} value */
    function formatValue(value) {
        return (value > 0 ? '+' : '') + value.toFixed(2);
    }

    /** @param {number} value */
    function valueColor(value) {
        if (value >= 0.1) return 'text-orange-500';
        if (value <= -0.1) return 'text-blue-500';
        return 'text-gray-400 dark:text-gray-500';
    }

    /** @param {string} playerName */
    function handlePlayerClick(playerName) {
        goto(resolve(`/rankings/${playerName}`, {}));
    }
</script>

{#if entries.length === 0}
    <p class="py-8 text-center text-gray-500">No form data yet.</p>
{:else}
    <div class="mb-2 flex items-center justify-between text-xs text-gray-400">
        <span>{hotCount} heating up · {coldCount} cooling off</span>
        <span class="flex items-center gap-2">
            <span class="flex items-center gap-1">
                <span class="inline-block h-2 w-2 rounded-full bg-orange-500"></span> hot
            </span>
            <span class="flex items-center gap-1">
                <span class="inline-block h-2 w-2 rounded-full bg-blue-500"></span> cold
            </span>
        </span>
    </div>
    <Table
        classes={{ div: 'w-full' }}
        class="table-fixed dark:text-gray-300">
        <TableHead class="dark:text-gray-300">
            <TableHeadCell class="w-6 px-1 py-1.5 text-center">#</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 font-bold text-gray-900 dark:text-gray-100"
                >Player</TableHeadCell>
            <TableHeadCell class="w-14 px-1 py-1.5 text-center">Streak</TableHeadCell>
            <TableHeadCell class="w-2/5 px-1 py-1.5 text-center">Form</TableHeadCell>
            <TableHeadCell class="w-10 px-1 py-1.5 text-right">+/-</TableHeadCell>
        </TableHead>
        <TableBody>
            {#each entries as entry, index (entry.playerName)}
                <TableBodyRow>
                    <TableBodyCell class="w-6 px-1 py-1.5 text-center">
                        {index + 1}
                    </TableBodyCell>
                    <TableBodyCell class="max-w-0 px-1 py-1.5">
                        <span class="flex min-w-0 items-center gap-1">
                            <span
                                class="cursor-pointer overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-gray-900 hover:underline dark:text-gray-100"
                                role="button"
                                tabindex="0"
                                onclick={() => handlePlayerClick(entry.playerName)}
                                onkeydown={() => handlePlayerClick(entry.playerName)}>
                                {entry.playerName}
                            </span>
                            {#if entry.provisional}
                                <span
                                    class="shrink-0 rounded border border-gray-300 px-1 text-[9px] text-gray-400 uppercase dark:border-gray-600"
                                    title="Provisional: only {entry.sessions} session{entry.sessions ===
                                    1
                                        ? ''
                                        : 's'} played">
                                    new
                                </span>
                            {/if}
                        </span>
                    </TableBodyCell>
                    <TableBodyCell class="w-14 px-1 py-1.5">
                        <span class="flex items-center justify-center gap-1">
                            {#each entry.badges as badge (badge.type)}
                                {@const meta = badgeMeta[badge.type]}
                                {#if meta}
                                    {@const BadgeIcon = meta.icon}
                                    <span
                                        class="flex shrink-0 items-center {meta.color}"
                                        title="{meta.label}: {badge.count} sessions">
                                        <BadgeIcon class="h-4 w-4" />
                                        <span class="text-[10px] font-bold">{badge.count}</span>
                                    </span>
                                {/if}
                            {/each}
                        </span>
                    </TableBodyCell>
                    <TableBodyCell class="w-2/5 px-1 py-1.5">
                        <MomentumBar
                            value={entry.value}
                            segments={segments(entry)}
                            provisional={entry.provisional} />
                    </TableBodyCell>
                    <TableBodyCell
                        class="w-10 px-1 py-1.5 text-right font-medium {valueColor(entry.value)}">
                        {formatValue(entry.value)}
                    </TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{/if}
