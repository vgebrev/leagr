<script>
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { Button, Accordion, AccordionItem } from 'flowbite-svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import EloRankingsTable from './components/EloRankingsTable.svelte';
    import EloInfoPanel from './components/EloInfoPanel.svelte';

    let rankings = $state({ players: [], metadata: {} });

    async function updateEloRankings() {
        await withLoading(
            async () => {
                rankings = await api.post('elo-rankings');
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Unable to update Elo rankings. Please try again.',
                    'error'
                );
            }
        );
    }

    async function loadEloRankings() {
        await withLoading(
            async () => {
                rankings = await api.get('elo-rankings');
            },
            (err) => {
                console.error(err);
                setNotification(err.message || 'Unable to load Elo rankings.', 'error');
            }
        );
    }

    onMount(() => {
        loadEloRankings();
    });
</script>

<svelte:head>
    <title>Elo Rankings</title>
</svelte:head>

<div class="w-full px-4 py-8">
    <div class="mb-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <TrophyIcon class="h-8 w-8 text-yellow-600" />
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Elo Rankings</h1>
                    <p class="text-gray-600 dark:text-gray-400">
                        Player skill ratings based on Elo system with activity weighting
                    </p>
                </div>
            </div>

            <div class="flex space-x-2">
                <Button
                    color="primary"
                    size="md"
                    onclick={updateEloRankings}>
                    Update Rankings
                </Button>
            </div>
        </div>
    </div>

    <!-- Info Accordion -->
    <div class="mb-6">
        <Accordion flush={true}>
            <AccordionItem>
                <span
                    slot="header"
                    class="text-base font-medium text-gray-900 dark:text-white">
                    📊 System Information & How Elo Works
                </span>
                <EloInfoPanel {rankings} />
            </AccordionItem>
        </Accordion>
    </div>

    <!-- Full-width Rankings Table -->
    <EloRankingsTable players={rankings.players} />
</div>
