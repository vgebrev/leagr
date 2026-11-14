<script>
    import { Badge } from 'flowbite-svelte';
    import { pushState } from '$app/navigation';
    import TeamBadge from '#components/TeamBadge.svelte';
    import StarAwardChip from '#components/StarAwardChip.svelte';
    import TrophyIcon from '#components/Icons/TrophyIcon.svelte';
    import CrownIcon from '#components/Icons/CrownIcon.svelte';
    import { formatCupRound, ordinal } from '#lib/shared/helpers.js';
    import { preserveScroll } from '#lib/client/preserveScroll.js';

    /**
     * One session appearance: team, result, honours and points. The team badge opens the
     * team modal through `page.state.teamModal`, so the hosting page must mount a
     * TeamModal bound to it.
     * @type {{ detail: PlayerSessionDetail | ChampionSession, hasBorder?: boolean }}
     */
    let { detail, hasBorder = true } = $props();

    /** @type {HTMLElement | undefined} */
    let cardEl = $state();

    /**
     * Format date for display
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {string} Formatted date
     */
    function formatDate(date) {
        return new Date(date).toLocaleDateString('en-GB', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function openTeam() {
        if (!detail.team) return;
        preserveScroll(cardEl);
        pushState('', { teamModal: { teamName: detail.team, date: detail.date } });
    }

    const leagueResult = $derived(
        detail.leaguePosition != null ? ordinal(detail.leaguePosition) : null
    );
    // The row already says "Cup", so the winner reads "Cup Winner" → "Winner".
    const cupResult = $derived(
        detail.cupProgress === 'winner' ? 'Winner' : formatCupRound(detail.cupProgress)
    );
    const awards = $derived(detail.awards ?? []);
    const hasHonours = $derived(detail.leagueWinner || detail.cupWinner || awards.length > 0);

    // `short` replaces the label where the card is too narrow for it (the two-column
    // history grid, popovers) - an abbreviation reads better than "Appe…" / "Knoc…".
    const points = $derived([
        { label: 'Appearance', short: 'App', value: detail.appearancePoints },
        { label: 'Match', short: 'Match', value: detail.matchPoints },
        { label: 'Bonus', short: 'Bonus', value: detail.bonusPoints },
        { label: 'Knockout', short: 'KO', value: detail.knockoutPoints }
    ]);
    const hasPoints = $derived(detail.totalPoints != null);
</script>

<div
    bind:this={cardEl}
    class="divide-y divide-gray-200 rounded-lg px-2 dark:divide-gray-700 {hasBorder
        ? 'glass border border-gray-200 dark:border-gray-700'
        : ''}">
    <!-- Five sections, each `py-1.5` with a divider between: date and team / result /
         honours / points / total and ELO -->
    <!-- Date and team -->
    <!-- Wraps rather than truncating the team: in the narrow two-column grid the name
         drops under the date, since it is the card's one control -->
    <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5">
        <div class="shrink-0 text-sm font-semibold dark:text-gray-200">
            {formatDate(detail.date)}
        </div>
        {#if detail.team}
            <TeamBadge
                teamName={detail.team}
                className="ml-auto max-w-full"
                onclick={openTeam} />
        {/if}
    </div>

    <!-- Final league position and cup performance -->
    {#if leagueResult || cupResult}
        <div
            data-testid="session-result"
            class="flex flex-wrap gap-x-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
            {#if leagueResult}
                <span
                    >League <span class="font-semibold text-gray-900 dark:text-gray-100"
                        >{leagueResult}</span
                    ></span>
            {/if}
            {#if cupResult}
                <span
                    >Cup <span class="font-semibold text-gray-900 dark:text-gray-100"
                        >{cupResult}</span
                    ></span>
            {/if}
        </div>
    {/if}

    <!-- Trophies and Stars of the Day -->
    {#if hasHonours}
        <div
            data-testid="session-honours"
            class="flex flex-wrap items-center gap-1 py-1.5">
            {#if detail.leagueWinner}
                <Badge
                    color="yellow"
                    class="flex items-center gap-1 text-xs">
                    <CrownIcon class="h-3 w-3" />
                    League
                </Badge>
            {/if}
            {#if detail.cupWinner}
                <Badge
                    color="orange"
                    class="flex items-center gap-1 text-xs">
                    <TrophyIcon class="h-3 w-3" />
                    Cup
                </Badge>
            {/if}
            {#each awards as award (award)}
                <StarAwardChip {award} />
            {/each}
        </div>
    {/if}

    <!-- Points breakdown, then total and ELO -->
    {#if hasPoints}
        <!-- The container is this strip, not the card: a size container contributes no
             intrinsic width, and inside a popover the card is what sizes the popover -->
        <div class="@container grid grid-cols-4 gap-1 py-1.5 text-center">
            {#each points as item (item.label)}
                <div
                    class="min-w-0"
                    data-points={item.label}>
                    <div
                        class="text-xs text-nowrap text-gray-600 dark:text-gray-300"
                        title={item.label}>
                        <span class="@[17rem]:hidden">{item.short}</span>
                        <span class="hidden @[17rem]:inline">{item.label}</span>
                    </div>
                    <div
                        data-points-value
                        class="text-sm font-medium {item.value
                            ? 'dark:text-gray-200'
                            : 'text-gray-400 dark:text-gray-500'}">
                        +{item.value ?? 0}
                    </div>
                </div>
            {/each}
        </div>
        <div class="flex items-center justify-between py-1.5 text-sm">
            <span class="flex items-center gap-1.5 font-semibold dark:text-gray-200">
                Total
                <Badge
                    color="gray"
                    class="font-bold">
                    {detail.totalPoints}
                </Badge>
            </span>
            {#if detail.eloRating}
                <span class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    ELO
                    <Badge color="blue">
                        {Math.round(detail.eloRating)}
                    </Badge>
                </span>
            {/if}
        </div>
    {/if}
</div>
