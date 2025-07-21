<script>
    import { Alert, Button, Label, Radio } from 'flowbite-svelte';
    import {
        AdjustmentsHorizontalSolid,
        ExclamationCircleSolid,
        UsersGroupSolid,
        UserSolid
    } from 'flowbite-svelte-icons';
    import { settings } from '$lib/client/stores/settings.js';

    let { teamConfig, date, canGenerateTeams, hasExistingTeams, ongenerate, playerSummary } =
        $props();

    let selectedTeamConfig = $state(null);
    let confirmRegenerate = $state(false);

    // Check if player limit exceeds team generation capacity
    let isConfigurationConflict = $derived.by(() => {
        if (teamConfig.length > 0 || !playerSummary) return false; // Valid configs exist or data not loaded

        const teamGen = $settings.teamGeneration;
        const maxCapacity = teamGen.maxTeams * teamGen.maxPlayersPerTeam;
        const minRequired = teamGen.minTeams * teamGen.minPlayersPerTeam;

        // Configuration conflict: eligible players exceed what team generation can handle
        return playerSummary.eligible > maxCapacity && playerSummary.eligible >= minRequired;
    });

    let configurationMessage = $derived.by(() => {
        if (!isConfigurationConflict || !playerSummary) return '';

        const teamGen = $settings.teamGeneration;
        const maxCapacity = teamGen.maxTeams * teamGen.maxPlayersPerTeam;
        const effectivePlayerLimit = $settings[date]?.playerLimit || $settings.playerLimit;

        return `Player limit exceeds team capacity (${maxCapacity} max). Adjust limits in`;
    });

    async function handleGenerate(regenerate = false) {
        if (!regenerate && hasExistingTeams) {
            confirmRegenerate = true;
            return;
        }

        await ongenerate(selectedTeamConfig);
        confirmRegenerate = false;
    }
</script>

<Label>Choose team option</Label>
<div class="flex w-full flex-col gap-2">
    {#each teamConfig as config, i (i)}
        <div class="rounded-md border p-2">
            <Radio
                bind:group={selectedTeamConfig}
                value={config}
                disabled={!canGenerateTeams}
                ><div class="items-between flex gap-2">
                    <span class="semi-bold">{config.teams} Teams</span><span
                        >({config.teamSizes.join(', ')} Players)</span>
                </div></Radio>
        </div>
    {/each}
    {#if teamConfig.length === 0}
        {#if isConfigurationConflict}
            <Alert class="flex items-center border py-2"
                ><ExclamationCircleSolid /><span
                    >{configurationMessage}
                    <Button
                        color="alternative"
                        href="/settings?date={date}"
                        size="xs"
                        ><AdjustmentsHorizontalSolid class="me-2 h-4 w-4" />Settings</Button
                    ></span
                ></Alert>
        {:else}
            <Alert class="flex items-center border py-2"
                ><ExclamationCircleSolid /><span
                    >More <Button
                        color="alternative"
                        href="/players?date={date}"
                        size="xs"><UserSolid class="me-2 h-4 w-4"></UserSolid>Players</Button> are needed
                    to make teams.</span
                ></Alert>
        {/if}
    {/if}
</div>
<Button
    onclick={() => handleGenerate(false)}
    disabled={!canGenerateTeams}><UsersGroupSolid class="me-2 h-4 w-4" /> Generate Teams</Button>
{#if confirmRegenerate}
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid /><span
            >Teams have already been generated. Are you sure you want to regenerate them?
            <Button
                size="sm"
                onclick={() => handleGenerate(true)}>Yes</Button
            ></span
        ></Alert>
{/if}
