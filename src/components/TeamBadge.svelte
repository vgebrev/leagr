<script>
  import { teamStyles, teamColours, titleCase } from '$lib/helpers.js';

  let { teamName, teams, className } = $props();

  let teamIndex = $derived(Object.keys(teams).indexOf(teamName));
  let teamColour = $derived(teamColours[teamIndex % teamColours.length]);
  let styles = $derived(teamStyles[teamColour] || teamStyles.default);
</script>

<span
  class={`${styles.header} ${className} overflow-hidden rounded-sm px-1 py-0.5 text-center text-sm font-medium text-nowrap overflow-ellipsis uppercase shadow`}
  >{titleCase(teamName)}</span
>
