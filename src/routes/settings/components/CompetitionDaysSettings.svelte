<script>
    import { Label, MultiSelect } from 'flowbite-svelte';

    /**
     * @typedef {Object} WeekdayOption
     * @property {number} value - The weekday number (0=Sunday, 6=Saturday)
     * @property {string} name - The display name for the weekday
     */

    /**
     * @typedef {Object} CompetitionDaysSettingsProps
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {number[]} leagueSettings.competitionDays - The array of weekday numbers for competition days
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {CompetitionDaysSettingsProps} */
    let { leagueSettings, onSave } = $props();

    /**
     * The days of the week options for the multiselect component.
     * @type {WeekdayOption[]}
     */
    const weekdayOptions = [
        { value: 0, name: 'Sunday' },
        { value: 1, name: 'Monday' },
        { value: 2, name: 'Tuesday' },
        { value: 3, name: 'Wednesday' },
        { value: 4, name: 'Thursday' },
        { value: 5, name: 'Friday' },
        { value: 6, name: 'Saturday' }
    ];
</script>

<div class="flex flex-col gap-2">
    <Label for="competition-days">Day(s) of the week when matches are held</Label>
    <MultiSelect
        items={weekdayOptions}
        bind:value={leagueSettings.competitionDays}
        placeholder="Select competition days..."
        onchange={onSave}
        id="competition-days" />
</div>