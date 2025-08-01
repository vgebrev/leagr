<script>
    import { Button, Alert } from 'flowbite-svelte';
    import {
        CalendarMonthSolid,
        CirclePlusSolid,
        ExclamationCircleSolid,
        UsersGroupSolid
    } from 'flowbite-svelte-icons';
    import TrophyIcon from '$components/TrophyIcon.svelte';

    let {
        hasTeams = false,
        hasSchedule = false,
        canResetSchedule = true,
        competitionEnded = false,
        onGenerateSchedule,
        onAddMoreGames,
        onAddKnockoutGames,
        date = ''
    } = $props();

    let showConfirmRegenerate = $state(false);

    /**
     * Handle schedule generation request
     * @param {boolean} forceRegenerate - Whether to force regeneration
     */
    async function handleGenerateSchedule(forceRegenerate = false) {
        if (hasSchedule && !forceRegenerate && !canResetSchedule) {
            return; // Already has schedule and can't reset
        }

        if (hasSchedule && !forceRegenerate) {
            showConfirmRegenerate = true;
            return;
        }

        showConfirmRegenerate = false;

        if (onGenerateSchedule) {
            await onGenerateSchedule();
        }
    }

    /**
     * Handle adding more games
     */
    async function handleAddMoreGames() {
        if (onAddMoreGames) {
            await onAddMoreGames();
        }
    }

    /**
     * Handle adding knockout games
     */
    async function handleAddKnockoutGames() {
        if (onAddKnockoutGames) {
            await onAddKnockoutGames();
        }
    }
</script>

<!-- No teams warning -->
{#if !hasTeams}
    <Alert class="flex items-center border py-2">
        <ExclamationCircleSolid />
        <span>
            Make some
            <Button
                color="alternative"
                href="/teams?date={date}"
                size="xs">
                <UsersGroupSolid class="me-2 h-4 w-4" />
                Teams
            </Button>
            before scheduling games.
        </span>
    </Alert>
{/if}

<!-- Main schedule generation button -->
<Button
    onclick={() => handleGenerateSchedule(false)}
    disabled={!hasTeams || competitionEnded || (!canResetSchedule && hasSchedule)}>
    <CalendarMonthSolid class="me-2 h-4 w-4" />
    Schedule Games
</Button>

<!-- Regeneration confirmation -->
{#if showConfirmRegenerate}
    <Alert class="flex items-center border">
        <ExclamationCircleSolid />
        <span>Games have already been scheduled. Are you sure you want to reset the schedule?</span>
        <Button
            size="sm"
            onclick={() => handleGenerateSchedule(true)}>
            Yes
        </Button>
    </Alert>
{/if}

<!-- Add more games button (only show if there's already a schedule) -->
{#if hasSchedule}
    <Button
        disabled={!hasTeams || competitionEnded}
        onclick={handleAddMoreGames}>
        <CirclePlusSolid class="me-2 h-4 w-4" />
        Add More Games
    </Button>

    <!-- Add knockout games button (only show if there's already a schedule) -->
    <Button
        disabled={!hasTeams || competitionEnded}
        onclick={handleAddKnockoutGames}>
        <TrophyIcon class="me-2 h-4 w-4" />
        Add Knockout Games
    </Button>
{/if}
