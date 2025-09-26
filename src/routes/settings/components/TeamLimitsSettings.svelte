<script>
    import { Input, Label } from 'flowbite-svelte';

    /**
     * @typedef {Object} TeamGeneration
     * @property {number} minTeams - The minimum number of teams allowed
     * @property {number} maxTeams - The maximum number of teams allowed
     * @property {number} minPlayersPerTeam - The minimum number of players per team
     * @property {number} maxPlayersPerTeam - The maximum number of players per team
     */

    /**
     * @typedef {Object} TeamLimitsSettingsProps
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {TeamGeneration} leagueSettings.teamGeneration - The team generation configuration
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {TeamLimitsSettingsProps} */
    let { leagueSettings, onSave } = $props();
</script>

<div class="flex flex-col gap-2 border-t border-t-gray-300 pt-2 dark:border-t-gray-600">
    <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">Team Limits</div>

    <div class="grid grid-cols-2 gap-2">
        <div>
            <Label for="min-teams">Min Teams</Label>
            <Input
                bind:value={leagueSettings.teamGeneration.minTeams}
                id="min-teams"
                type="number"
                step={1}
                min={2}
                max={leagueSettings.teamGeneration.maxTeams}
                onchange={onSave}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
        </div>

        <div>
            <Label for="max-teams">Max Teams</Label>
            <Input
                bind:value={leagueSettings.teamGeneration.maxTeams}
                id="max-teams"
                type="number"
                step={1}
                min={leagueSettings.teamGeneration.minTeams}
                max={5}
                onchange={onSave}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
        </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
        <div>
            <Label for="min-players-per-team">Min Players per Team</Label>
            <Input
                bind:value={leagueSettings.teamGeneration.minPlayersPerTeam}
                id="min-players-per-team"
                type="number"
                step={1}
                min={3}
                max={leagueSettings.teamGeneration.maxPlayersPerTeam}
                onchange={onSave}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
        </div>

        <div>
            <Label for="max-players-per-team">Max Players per Team</Label>
            <Input
                bind:value={leagueSettings.teamGeneration.maxPlayersPerTeam}
                id="max-players-per-team"
                type="number"
                step={1}
                min={leagueSettings.teamGeneration.minPlayersPerTeam}
                max={15}
                onchange={onSave}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
        </div>
    </div>
</div>
