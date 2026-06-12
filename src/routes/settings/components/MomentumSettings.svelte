<script>
    import { Input, Label, Toggle } from 'flowbite-svelte';
    import { getEffectiveMomentumSettings } from '$lib/shared/defaults.js';

    /** @typedef {import('$lib/shared/types.js').MomentumSettings} MomentumSettings */

    /**
     * @typedef {Object} MomentumSettingsProps
     * @property {import('$lib/shared/types.js').LeagueSettings & {momentum: MomentumSettings}} leagueSettings - The league-wide settings object
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {MomentumSettingsProps} */
    let { leagueSettings = $bindable(), onSave } = $props();

    // Backfill nested defaults so bindings always have a full structure -
    // a league saved before this feature has no momentum block, and the page
    // replaces leagueSettings wholesale after loading from the API
    leagueSettings.momentum = getEffectiveMomentumSettings(leagueSettings);
    $effect(() => {
        const momentum = leagueSettings.momentum;
        if (!momentum || !momentum.ballers || !momentum.champions) {
            leagueSettings.momentum = getEffectiveMomentumSettings(leagueSettings);
        }
    });

    /** @type {Array<{key: 'champions'|'ballers', label: string}>} */
    const boards = [
        { key: 'champions', label: 'Champions Hall (placement)' },
        { key: 'ballers', label: 'Ballers Board (contributions)' }
    ];

    /** @type {Array<{key: keyof import('$lib/shared/types.js').MomentumBoardConfig, label: string, min: number, max: number, step: number}>} */
    const fields = [
        { key: 'fastHalfLifeWeeks', label: 'Fast half-life (weeks)', min: 0.5, max: 26, step: 0.5 },
        { key: 'slowHalfLifeWeeks', label: 'Slow half-life (weeks)', min: 2, max: 52, step: 0.5 },
        {
            key: 'coolHalfLifeWeeks',
            label: 'Cooling half-life (weeks)',
            min: 0.5,
            max: 26,
            step: 0.5
        },
        { key: 'minSessions', label: 'Min. sessions', min: 1, max: 20, step: 1 }
    ];
</script>

<div class="flex flex-col gap-2 border-t border-t-gray-300 pt-2 dark:border-t-gray-600">
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.momentum.enabled}
        onchange={onSave}>
        Enable form (momentum) boards
    </Toggle>

    {#if leagueSettings.momentum.enabled}
        {#each boards as board (board.key)}
            <div class="flex flex-col gap-2 text-sm">
                <Label>{board.label}:</Label>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {#each fields as field (field.key)}
                        <div class="flex flex-col gap-1">
                            <Label
                                for="momentum-{board.key}-{field.key}"
                                class="text-xs font-normal text-gray-600 dark:text-gray-400">
                                {field.label}
                            </Label>
                            <Input
                                id="momentum-{board.key}-{field.key}"
                                bind:value={leagueSettings.momentum[board.key][field.key]}
                                type="number"
                                min={field.min}
                                max={field.max}
                                step={field.step}
                                onchange={onSave}
                                class="!bg-gray-50 dark:!bg-gray-800" />
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
        <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Form measures hot/cold streaks against each player's own baseline. Faster half-lives
            react quicker; the cooling half-life fades the signal between appearances; players below
            the minimum sessions show as provisional.
        </div>
    {/if}
</div>
