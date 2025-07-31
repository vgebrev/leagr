<script>
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';
    import { isDateInPast } from '$lib/shared/helpers.js';
    import ScheduleDisplay from './components/ScheduleDisplay.svelte';
    import GameActions from './components/GameActions.svelte';

    let { data } = $props();

    /** @type {string} */
    const date = data.date;

    /** @type {boolean} */
    let isPast = $derived(isDateInPast(date));

    /** @type {Array<Array<Object>>} */
    let schedule = $state([]);

    /** @type {number} */
    let anchorIndex = $state(0);

    /** @type {number} */
    let teamCount = $state(0);

    /** @type {boolean} */
    let hasTeams = $derived(teamCount > 0);

    /** @type {boolean} */
    let hasSchedule = $derived(schedule.length > 0);

    /**
     * Helper to execute operations with schedule restore on failure
     * @param {() => Promise<any>} operation - Async operation to execute
     * @param {string} errorMessage - Error message to show on failure
     */
    async function withScheduleRestore(operation, errorMessage) {
        const restoreSchedule = schedule;
        await withLoading(operation, (err) => {
            console.error(err);
            setNotification(err.message || errorMessage, 'error');
            schedule = restoreSchedule;
        });
    }

    /**
     * Generate a new schedule
     */
    async function generateSchedule() {
        if (isPast) {
            setNotification('The date is in the past. Games cannot be changed.', 'warning');
            return;
        }

        await withScheduleRestore(async () => {
            const requestData = {
                operation: 'generate',
                anchorIndex: Math.floor(Math.random() * teamCount)
            };

            const scheduleData = await api.post('games', date, requestData);
            schedule = scheduleData.rounds || [];
            anchorIndex = scheduleData.anchorIndex || 0;
            teamCount = scheduleData.teamCount || 0;
        }, 'Failed to generate schedule. Please try again.');
    }

    /**
     * Add more games to the current schedule
     */
    async function addMoreGames() {
        if (isPast) {
            setNotification('The date is in the past. Games cannot be changed.', 'warning');
            return;
        }

        await withScheduleRestore(async () => {
            const requestData = {
                operation: 'addMore',
                anchorIndex: anchorIndex
            };

            const gameData = await api.post('games', date, requestData);
            schedule = gameData.rounds || [];
            anchorIndex = gameData.anchorIndex || anchorIndex;
            teamCount = gameData.teamCount || teamCount;
        }, 'Failed to add more games. Please try again.');
    }

    /**
     * Handle match score update
     * @param {number} roundIndex - Index of the round
     * @param {number} matchIndex - Index of the match within the round
     * @param {Object} updatedMatch - Updated match object
     */
    async function handleMatchUpdate(roundIndex, matchIndex, updatedMatch) {
        // Update the local schedule immediately for responsiveness
        const newSchedule = [...schedule];
        newSchedule[roundIndex] = [...newSchedule[roundIndex]];
        newSchedule[roundIndex][matchIndex] = updatedMatch;
        schedule = newSchedule;

        // Save to server
        await withScheduleRestore(async () => {
            const requestData = {
                rounds: schedule,
                anchorIndex: anchorIndex
            };

            const scoreData = await api.post('games', date, requestData);
            schedule = scoreData.rounds || schedule;
            teamCount = scoreData.teamCount || teamCount;
        }, 'Failed to save score. Please try again.');
    }

    onMount(async () => {
        await withLoading(
            async () => {
                // Load games data (now includes team count)
                const gamesData = await api.get('games', date);

                schedule = gamesData?.rounds || [];
                anchorIndex = gamesData?.anchorIndex || 0;
                teamCount = gamesData?.teamCount || 0;
            },
            (err) => {
                console.error('Error fetching data:', err);
                setNotification(
                    err.message || 'Failed to load schedule data. Please try again.',
                    'error'
                );
            }
        );
    });
</script>

<!-- Game Actions Component -->
<GameActions
    {hasTeams}
    {hasSchedule}
    canResetSchedule={$settings.canResetSchedule}
    {isPast}
    {date}
    onGenerateSchedule={generateSchedule}
    onAddMoreGames={addMoreGames} />

<!-- Schedule Display Component -->
<ScheduleDisplay
    {schedule}
    disabled={isPast}
    onMatchUpdate={handleMatchUpdate} />
