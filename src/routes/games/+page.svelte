<script>
    import { onMount } from 'svelte';
    import { settings } from '$lib/client/stores/settings.js';
    import { isCompetitionEnded } from '$lib/shared/helpers.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { gamesService } from '$lib/client/services/games.svelte.js';
    import ScheduleDisplay from './components/ScheduleDisplay.svelte';
    import GameActions from './components/GameActions.svelte';
    import TeamModal from '$components/TeamModal.svelte';
    import { titleParts } from '$lib/client/stores/pageTitle.js';

    let { data } = $props();

    /** @type {string} */
    const date = data.date;

    let showTeamModal = $state(false);
    /** @type {string | null} */
    let selectedTeam = $state(null);

    /**
     * @param {string} teamName
     */
    function handleTeamClick(teamName) {
        selectedTeam = teamName;
        showTeamModal = true;
    }

    /** @type {boolean} */
    let competitionEnded = $derived(isCompetitionEnded(date, $settings));

    async function generateSchedule() {
        if (competitionEnded) {
            setNotification('The competition has ended. Games cannot be changed.', 'warning');
            return;
        }
        await gamesService.generateSchedule();
    }

    async function addMoreGames() {
        if (competitionEnded) {
            setNotification('The competition has ended. Games cannot be changed.', 'warning');
            return;
        }
        await gamesService.addMoreGames();
    }

    onMount(async () => {
        await gamesService.load(date);
    });

    $effect(() => {
        titleParts.set(['Games']);
        return () => titleParts.set([]);
    });
</script>

<GameActions
    hasTeams={gamesService.hasTeams}
    hasSchedule={gamesService.hasSchedule}
    canResetSchedule={$settings.canResetSchedule}
    {competitionEnded}
    {date}
    onGenerateSchedule={generateSchedule}
    onAddMoreGames={addMoreGames} />

<ScheduleDisplay
    schedule={gamesService.schedule}
    teams={gamesService.teams}
    {date}
    disabled={competitionEnded}
    onMatchUpdate={(roundIndex, matchIndex, updatedMatch) =>
        gamesService.updateLeagueMatch(roundIndex, matchIndex, updatedMatch)}
    onTeamClick={handleTeamClick} />

<TeamModal
    bind:teamName={selectedTeam}
    {date}
    bind:open={showTeamModal} />
