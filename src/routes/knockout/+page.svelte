<script>
    import { onMount } from 'svelte';
    import { Alert, Button } from 'flowbite-svelte';
    import { settings } from '$lib/client/stores/settings.js';
    import { gamesService } from '$lib/client/services/games.svelte.js';
    import KnockoutBracket from './components/KnockoutBracket.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import TeamModal from '$components/TeamModal.svelte';
    import StarsOfTheDay from '$components/StarsOfTheDay.svelte';
    import { isCompetitionEnded, teamColours } from '$lib/shared/helpers.js';
    import { CalendarMonthSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';

    let { data } = $props();
    const date = data.date;

    let showTeamModal = $state(false);
    let selectedTeam = $state(null);

    /**
     * Get the winner of a knockout match, including penalty tiebreaker.
     * @param {Object} match
     * @returns {string|null}
     */
    function getKnockoutWinner(match) {
        if (match.homeScore === null || match.awayScore === null) return null;
        if (match.homeScore > match.awayScore) return match.home;
        if (match.awayScore > match.homeScore) return match.away;
        if (match.homePenalties != null && match.awayPenalties != null) {
            if (match.homePenalties > match.awayPenalties) return match.home;
            if (match.awayPenalties > match.homePenalties) return match.away;
        }
        return null;
    }

    function handleTeamClick(teamName) {
        selectedTeam = teamName;
        showTeamModal = true;
    }

    /**
     * @typedef {Object} WinningTeam
     * @property {string} name
     * @property {import('$lib/shared/helpers.js').TeamColour} colour
     */

    /** @type {WinningTeam} */
    let winningTeam = $state({ name: '', colour: 'blue' });
    let celebrating = $state(false);
    let showConfirmRegenerate = $state(false);

    /**
     * Check for a tournament winner and trigger celebration.
     */
    function checkForWinner() {
        if (!gamesService.knockoutBracket?.bracket) return;

        const finalMatch = gamesService.knockoutBracket.bracket.find(
            (match) => match.round === 'final'
        );

        if (finalMatch) {
            const winner = getKnockoutWinner(finalMatch);
            if (winner && winner !== winningTeam.name) {
                winningTeam.name = winner;
                const firstWord = winner.split(' ')[0].toLowerCase();
                winningTeam.colour = teamColours.includes(firstWord) ? firstWord : 'blue';
                celebrating = true;
            }
        }
    }

    /**
     * @param {string} teamName
     */
    function celebrateTeam(teamName) {
        if (!gamesService.knockoutBracket?.bracket) return;

        const finalMatch = gamesService.knockoutBracket.bracket.find(
            (match) => match.round === 'final'
        );

        if (finalMatch) {
            const winner = getKnockoutWinner(finalMatch);
            if (winner && teamName === winner) {
                winningTeam.name = winner;
                const firstWord = winner.split(' ')[0].toLowerCase();
                winningTeam.colour = teamColours.includes(firstWord) ? firstWord : 'blue';
                celebrating = true;
            }
        }
    }

    /**
     * @param {Object} updatedMatch
     */
    async function handleKnockoutMatchUpdate(updatedMatch) {
        await gamesService.updateKnockoutMatch(updatedMatch);
        checkForWinner();
    }

    /**
     * @param {boolean} [forceRegenerate]
     */
    async function handleAddKnockoutGames(forceRegenerate = false) {
        if (gamesService.knockoutBracket && !forceRegenerate) {
            showConfirmRegenerate = true;
            return;
        }
        showConfirmRegenerate = false;
        await gamesService.addKnockoutGames();
        checkForWinner();
    }

    onMount(async () => {
        await gamesService.loadKnockout(date);
        checkForWinner();
    });
</script>

<div class="flex flex-col gap-2">
    {#if !gamesService.hasStandings}
        <Alert class="glass flex items-center border py-2"
            ><ExclamationCircleSolid /><span>
                The knockout cup phase is only available after some league <Button
                    color="alternative"
                    class="align-middle"
                    href="/games?date={date}"
                    size="xs"
                    ><CalendarMonthSolid class="me-2 h-4 w-4"></CalendarMonthSolid>Games</Button> have
                been played.</span>
        </Alert>
    {:else}
        <Button
            onclick={() => handleAddKnockoutGames(false)}
            disabled={isCompetitionEnded(date, $settings)}>
            <TrophyIcon class="me-2 h-4 w-4" />
            Start Knockout Cup Phase
        </Button>

        {#if showConfirmRegenerate}
            <Alert class="glass flex items-center border">
                <ExclamationCircleSolid />
                <span
                    >A knockout cup is already in progress. Are you sure you want to reset it?</span>
                <Button
                    size="xs"
                    onclick={() => handleAddKnockoutGames(true)}>
                    Yes
                </Button>
            </Alert>
        {/if}

        {#if gamesService.knockoutBracket}
            <KnockoutBracket
                bracket={gamesService.knockoutBracket}
                teams={gamesService.teams}
                {date}
                disabled={isCompetitionEnded(date, $settings)}
                onMatchUpdate={handleKnockoutMatchUpdate}
                onCelebrate={celebrateTeam}
                onTeamClick={handleTeamClick} />
        {/if}

        <div class="mt-4">
            <StarsOfTheDay
                leagueGames={gamesService.leagueGames}
                knockoutGames={gamesService.knockoutBracket?.bracket || []}
                teams={gamesService.teams} />
        </div>
    {/if}
</div>

<CelebrationOverlay
    bind:celebrating
    teamName={winningTeam.name}
    teamColour={winningTeam.colour}
    icon="🏆"
    {date} />

<TeamModal
    bind:teamName={selectedTeam}
    {date}
    bind:open={showTeamModal} />
