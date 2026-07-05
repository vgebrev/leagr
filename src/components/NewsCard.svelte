<script>
    import { pushState } from '$app/navigation';
    import { AngleDownOutline, FireSolid, StarSolid } from 'flowbite-svelte-icons';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import WoodenSpoonIcon from '$components/Icons/WoodenSpoonIcon.svelte';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import SnowflakeIcon from '$components/Icons/SnowflakeIcon.svelte';
    import { formatDisplayDate, titleCase } from '$lib/shared/helpers.js';

    /**
     * @typedef {Object} Thread
     * @property {string} type
     * @property {string} [player]
     * @property {number} [streak]
     * @property {string} [category]
     * @property {'extended'|'broken'|'started'|'carriedOver'} [outcome]
     * @property {number} [position]
     * @property {string} [team]
     * @property {string|null} [runnerUp]
     * @property {string|null} [finalist]
     * @property {number|null} [points]
     * @property {number|null} [margin]
     * @property {{winner: number, runnerUp: number}|null} [gd]
     * @property {boolean} [double]
     */

    /**
     * @type {{ card: { date: string, state: 'preview'|'recap', threads: Thread[] } }}
     */
    let { card } = $props();

    const awardLabels = {
        mvp: 'MVP',
        goldenBoot: 'Golden Boot',
        playmaker: 'Playmaker',
        brickWall: 'Brick Wall',
        goldenGlove: 'Golden Glove'
    };

    // Award icons mirror the Momentum board / Stars of the Day conventions
    const awardIcons = {
        mvp: StarSolid,
        goldenBoot: SoccerBootIcon,
        playmaker: BullseyeIcon,
        brickWall: ShieldIcon,
        goldenGlove: GloveIcon
    };

    /** @param {number} n */
    function ordinal(n) {
        const rem10 = n % 10;
        const rem100 = n % 100;
        if (rem10 === 1 && rem100 !== 11) return `${n}st`;
        if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
        if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
        return `${n}th`;
    }

    /** @param {number} n - a goal difference, shown with an explicit sign */
    function signed(n) {
        return n > 0 ? `+${n}` : `${n}`;
    }

    /** @param {Thread} thread */
    function iconFor(thread) {
        // A streak that just ended reads as a faded badge
        if (thread.outcome === 'broken') {
            return { icon: baseIconFor(thread).icon, color: 'text-gray-400 dark:text-gray-500' };
        }
        return baseIconFor(thread);
    }

    /** @param {Thread} thread */
    function baseIconFor(thread) {
        switch (thread.type) {
            case 'trophyStreak':
                return { icon: CrownIcon, color: 'text-yellow-500' };
            case 'spoonStreak':
                return { icon: WoodenSpoonIcon, color: 'text-amber-700' };
            case 'ballerStreak':
                return { icon: awardIcons[thread.category] ?? StarSolid, color: 'text-yellow-400' };
            case 'redHot':
                return { icon: FireSolid, color: 'text-orange-500' };
            case 'comeback':
                return { icon: SnowflakeIcon, color: 'text-blue-400' };
            case 'biggestMover':
                return { icon: FireSolid, color: 'text-green-500' };
            case 'biggestFaller':
                return { icon: AngleDownOutline, color: 'text-red-500' };
            case 'teamLeague':
                return { icon: CrownIcon, color: 'text-yellow-500' };
            case 'teamCup':
                // The double is drawn as crown + trophy in the markup, matching
                // the momentum board; the single-icon path is the plain cup win.
                return { icon: TrophyIcon, color: 'text-amber-600' };
            default:
                return { icon: StarSolid, color: 'text-gray-400' };
        }
    }

    /** @typedef {string | {player: string} | {team: string}} Segment */

    /** @param {string} name @returns {Segment} */
    const P = (name) => ({ player: name });
    /** @param {string} name @returns {Segment} */
    const T = (name) => ({ team: name });

    /**
     * The headline as an array of segments: plain strings interleaved with
     * clickable {player}/{team} tokens (each string carries its own spacing).
     * @param {Thread} thread
     * @returns {Segment[]}
     */
    function headlineSegments(thread) {
        const p = thread.player;
        const n = thread.streak;
        const preview = card.state === 'preview';
        switch (thread.type) {
            case 'trophyStreak':
                if (preview)
                    return [
                        'Can ',
                        P(p),
                        ` keep the silverware coming? ${n} sessions and counting.`
                    ];
                if (thread.outcome === 'extended')
                    return [P(p), ` makes it ${n} sessions of silverware in a row.`];
                if (thread.outcome === 'started')
                    return [P(p), ' goes back-to-back — a trophy run begins.'];
                if (thread.outcome === 'broken')
                    return [P(p), `'s ${n}-session trophy run comes to an end.`];
                return [P(p), ` sat out — the ${n}-session trophy run stays alive.`];
            case 'spoonStreak':
                if (preview) return ['Can ', P(p), ` escape the wooden spoon after ${n} in a row?`];
                if (thread.outcome === 'extended')
                    return ['The wooden spoon sticks with ', P(p), ` — ${n} sessions running.`];
                if (thread.outcome === 'started')
                    return ['Back-to-back wooden spoons for ', P(p), '.'];
                if (thread.outcome === 'broken')
                    return thread.position
                        ? [
                              P(p),
                              ` snaps a ${n}-session wooden-spoon run with a ${ordinal(thread.position)}-place finish!`
                          ]
                        : [P(p), ` snaps a ${n}-session wooden-spoon run!`];
                return [P(p), ` sat out — the wooden-spoon run stays at ${n}.`];
            case 'ballerStreak': {
                const award = awardLabels[thread.category] ?? thread.category;
                if (preview) return ['Can ', P(p), ` make it ${n + 1} ${award}s in a row?`];
                if (thread.outcome === 'extended')
                    return [P(p), ` makes it ${n} straight ${award}s.`];
                if (thread.outcome === 'started') return [P(p), ` goes back-to-back for ${award}.`];
                if (thread.outcome === 'broken') return [P(p), `'s ${award} run ends at ${n}.`];
                return [P(p), ` sat out — the ${award} run holds at ${n}.`];
            }
            case 'redHot':
                return [P(p), ' comes in red hot.'];
            case 'comeback':
                return ['Comeback brewing — ', P(p), ' is climbing back from the cold.'];
            case 'biggestMover':
                return [P(p), " is the week's biggest riser."];
            case 'biggestFaller':
                return [P(p), ' is on the steepest slide.'];
            case 'teamLeague': {
                const pts =
                    thread.points != null
                        ? `${thread.points} point${thread.points === 1 ? '' : 's'}`
                        : null;
                if (thread.runnerUp == null || thread.margin == null) {
                    return [
                        T(thread.team),
                        pts ? ` win the league with ${pts}.` : ' win the league.'
                    ];
                }
                if (thread.margin === 0) {
                    const both = pts ? ` — both on ${pts}` : '';
                    const gd = thread.gd
                        ? ` (goal difference ${signed(thread.gd.winner)} to ${signed(thread.gd.runnerUp)})`
                        : '';
                    return [
                        T(thread.team),
                        ' edge ',
                        T(thread.runnerUp),
                        ` to the league on goal difference${both}${gd}.`
                    ];
                }
                const clear = `${thread.margin} point${thread.margin === 1 ? '' : 's'} clear of `;
                return [
                    T(thread.team),
                    pts ? ` win the league with ${pts}, ${clear}` : ` win the league, ${clear}`,
                    T(thread.runnerUp),
                    '.'
                ];
            }
            case 'teamCup': {
                const also = thread.double ? ' also' : '';
                const dbl = thread.double ? ' — for the double' : '';
                if (thread.finalist) {
                    return [
                        T(thread.team),
                        `${also} win the cup, besting `,
                        T(thread.finalist),
                        ` in the final${dbl}.`
                    ];
                }
                return [T(thread.team), `${also} win the cup${dbl}.`];
            }
            default:
                return [p ?? ''];
        }
    }

    /** @param {string} name */
    function openPlayer(name) {
        pushState('', { playerModal: { playerName: name, date: card.date } });
    }

    /** @param {string} name */
    function openTeam(name) {
        pushState('', { teamModal: { teamName: name, date: card.date } });
    }

    /** @param {() => void} activate */
    function onKeyActivate(activate) {
        return (/** @type {KeyboardEvent} */ event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
            }
        };
    }
</script>

{#snippet lineIcon(/** @type {Thread} */ thread)}
    {#if thread.type === 'teamCup' && thread.double}
        <!-- Double: crown over trophy, stacked and small like the momentum board -->
        <span
            class="mt-0.5 flex shrink-0 flex-col items-center"
            title="League &amp; cup double">
            <CrownIcon class="h-3 w-3 text-yellow-500" />
            <TrophyIcon class="h-3 w-3 text-amber-600" />
        </span>
    {:else}
        {@const meta = iconFor(thread)}
        <meta.icon class="mt-0.5 h-4 w-4 shrink-0 {meta.color}" />
    {/if}
{/snippet}

{#snippet nameLink(/** @type {string} */ display, /** @type {() => void} */ activate)}
    <span
        class="cursor-pointer font-medium hover:underline"
        role="button"
        tabindex="0"
        onclick={activate}
        onkeydown={onKeyActivate(activate)}>{display}</span>
{/snippet}

<div class="glass rounded-lg border border-gray-200 p-3 shadow-sm dark:border-gray-700">
    <div class="mb-2 flex items-center justify-between">
        <h6 class="text-sm font-bold text-gray-900 dark:text-gray-100">
            {formatDisplayDate(card.date)}
        </h6>
        <span
            class="rounded-full px-2 py-0.5 text-xs font-medium {card.state === 'preview'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}">
            {card.state === 'preview' ? 'Preview' : 'Recap'}
        </span>
    </div>
    {#if card.threads.length === 0}
        <p class="text-xs text-gray-400">
            {card.state === 'preview'
                ? 'No stories yet — form builds from here.'
                : 'A quiet week at the office.'}
        </p>
    {:else}
        <ul class="flex flex-col divide-y divide-gray-100 dark:divide-gray-700/60">
            {#each card.threads as thread, i (i)}
                <li class="py-1.5 first:pt-0 last:pb-0">
                    {#if thread.type === 'starsOfTheDay'}
                        <div
                            class="flex w-full items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <StarSolid class="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                            <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span class="font-medium">Stars of the day:</span>
                                {#each thread.winners as winner (winner.category)}
                                    {@const Icon = awardIcons[winner.category] ?? StarSolid}
                                    <span
                                        class="inline-flex items-center gap-1"
                                        title={awardLabels[winner.category]}>
                                        <Icon class="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                                        <!-- prettier-ignore -->
                                        <span>{#each winner.players as name, idx (name)}{#if idx > 0}{idx === winner.players.length - 1 ? ' & ' : ', '}{/if}{@render nameLink(name, () => openPlayer(name))}{/each}</span>
                                    </span>
                                {/each}
                            </span>
                        </div>
                    {:else}
                        <div
                            class="flex w-full items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            {@render lineIcon(thread)}
                            <!-- prettier-ignore -->
                            <span>{#each headlineSegments(thread) as seg, idx (idx)}{#if typeof seg === 'string'}{seg}{:else if seg.player}{@render nameLink(seg.player, () => openPlayer(seg.player))}{:else}{@render nameLink(titleCase(seg.team), () => openTeam(seg.team))}{/if}{/each}</span>
                        </div>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}
</div>
