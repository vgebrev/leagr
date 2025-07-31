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
    
    /** @type {Record<string, Object>} */
    let teams = $state({});
    
    /** @type {string[]} */
    let teamNames = $derived(Object.keys(teams || {}));
    
    /** @type {boolean} */
    let hasTeams = $derived(teamNames.length > 0);
    
    /** @type {boolean} */
    let hasSchedule = $derived(schedule.length > 0);

    /**
     * Generate a new schedule
     */
    async function generateSchedule() {
        if (isPast) {
            setNotification('The date is in the past. Games cannot be changed.', 'warning');
            return;
        }

        const restoreSchedule = schedule;
        await withLoading(
            async () => {
                const requestData = {
                    operation: 'generate',
                    anchorIndex: Math.floor(Math.random() * teamNames.length)
                };

                const scheduleData = await api.post('games', date, requestData);
                schedule = scheduleData.rounds || [];
                anchorIndex = scheduleData.anchorIndex || 0;
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Failed to generate schedule. Please try again.',
                    'error'
                );
                schedule = restoreSchedule;
            }
        );
    }

    /**
     * Add more games to the current schedule
     */
    async function addMoreGames() {
        if (isPast) {
            setNotification('The date is in the past. Games cannot be changed.', 'warning');
            return;
        }

        const restoreSchedule = schedule;
        await withLoading(
            async () => {
                const requestData = {
                    operation: 'addMore',
                    anchorIndex: anchorIndex
                };

                const gameData = await api.post('games', date, requestData);
                schedule = gameData.rounds || [];
                anchorIndex = gameData.anchorIndex || anchorIndex;
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Failed to add more games. Please try again.',
                    'error'
                );
                schedule = restoreSchedule;
            }
        );
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
        const restoreSchedule = schedule;
        await withLoading(
            async () => {
                const requestData = {
                    rounds: schedule,
                    anchorIndex: anchorIndex
                };

                const scoreData = await api.post('games', date, requestData);
                schedule = scoreData.rounds || schedule;
            },
            (err) => {
                console.error(err);
                setNotification(err.message || 'Failed to save score. Please try again.', 'error');
                schedule = restoreSchedule;
            }
        );
    }

    onMount(async () => {
        await withLoading(
            async () => {
                // Load teams and games data in parallel
                const [teamsData, gamesData] = await Promise.all([
                    api.get('teams', date),
                    api.get('games', date)
                ]);

                teams = teamsData || {};
                schedule = gamesData?.rounds || [];
                anchorIndex = gamesData?.anchorIndex || 0;
            },
            (err) => {
                console.error('Error fetching data:', err);
                setNotification(
                    err.message || 'Failed to load team and schedule data. Please try again.',
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
