<script>
    import { Toggle } from 'flowbite-svelte';

    /**
     * @typedef {Object} BehaviorTogglesProps
     * @property {LeagueSettings} leagueSettings - The league-wide settings object
     * @property {{ enabled: boolean }} [leagueSettings.teamLogos] - Whether to generate AI team logos after draw
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {BehaviorTogglesProps} */
    let { leagueSettings = $bindable(), onSave } = $props();

    // A league saved before team logos existed has no block, and bind: cannot reach
    // through an optional chain.
    leagueSettings.teamLogos ??= { enabled: false };
    const teamLogos = $derived(leagueSettings.teamLogos ?? { enabled: false });
</script>

<div class="mt-2 space-y-3 border-t border-t-gray-300 pt-2 dark:border-t-gray-600">
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.canRegenerateTeams}
        onchange={onSave}>
        Allow team regeneration
    </Toggle>
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.canResetSchedule}
        onchange={onSave}>
        Allow schedule reset
    </Toggle>
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.seedTeams}
        onchange={onSave}>
        Balance teams using player rankings
    </Toggle>
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={teamLogos.enabled}
        onchange={onSave}>
        Generate AI team logos after draw
    </Toggle>
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.teamDrawRequiresAdmin}
        onchange={onSave}>
        Require admin to draw teams
    </Toggle>
</div>

<style lang="postcss"></style>
