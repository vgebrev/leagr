<script>
    import { Alert, Button, Label, Radio } from 'flowbite-svelte';
    import { ExclamationCircleSolid, UsersGroupSolid, UserSolid } from 'flowbite-svelte-icons';

    let { teamConfig, date, canGenerateTeams, confirmRegenerate, ongenerate } = $props();

    let selectedTeamConfig = $state(null);
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
        <Alert class="flex items-center border py-2"
            ><ExclamationCircleSolid /><span
                >More <Button
                    color="alternative"
                    href="/players?date={date}"
                    size="xs"><UserSolid class="me-2 h-4 w-4"></UserSolid>Players</Button> are needed
                to make teams.</span
            ></Alert>
    {/if}
</div>
<Button
    onclick={async () => await ongenerate(selectedTeamConfig, false)}
    disabled={!canGenerateTeams}><UsersGroupSolid class="me-2 h-4 w-4" /> Generate Teams</Button>
{#if confirmRegenerate}
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid /><span
            >Teams have already been generated. Are you sure you want to regenerate them?
            <Button
                size="sm"
                onclick={async () => await ongenerate(selectedTeamConfig, true)}>Yes</Button
            ></span
        ></Alert>
{/if}
