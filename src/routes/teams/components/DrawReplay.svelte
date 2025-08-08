<script>
    import { Button, Modal, Listgroup, ListgroupItem, ButtonGroup, Tooltip } from 'flowbite-svelte';
    import {
        PlaySolid,
        PauseSolid,
        ForwardStepSolid,
        BackwardStepSolid
    } from 'flowbite-svelte-icons';
    import TeamTable from './TeamTable.svelte';
    import { onMount } from 'svelte';
    import { scale, fade } from 'svelte/transition';
    import ArrowRotateIcon from '$components/Icons/ArrowRotateIcon.svelte';
    import { teamStyles } from '$lib/shared/helpers.js';
    import { SvelteSet } from 'svelte/reactivity';
    import confetti from 'canvas-confetti';

    let { drawHistory, open = $bindable(false) } = $props();

    let isPlaying = $state(false);
    let currentStep = $state(0);
    let intervalId = null;

    // Animation state for visual transitions
    let animatingPlayer = $state(null);
    let animatingPlayerTeam = $state(null);
    let completedAnimations = $state(new Set());
    let completedSteps = $state(0); // For team table updates (delayed)

    // Flying player animation (uses same animatingPlayer state)
    let flyingPlayerPosition = $state({ x: 0, y: 0 });
    let flyingPlayerScale = $state('scale-100');
    let isFlying = $state(false);

    // Track active timeouts for cleanup
    let activeTimeouts = $state([]);

    // Get team color classes for the animating player
    const animatingPlayerClasses = $derived.by(() => {
        if (!animatingPlayer || !animatingPlayerTeam) {
            return '';
        }

        const teamColor = animatingPlayerTeam.split(' ')[0].toLowerCase();
        const teamStyle = teamStyles[teamColor] || teamStyles.default || teamStyles.blue;
        return `animate-pulse ${teamStyle.text}`;
    });

    // Get team color classes for the flying player (uses unified animating state)
    const flyingPlayerClasses = $derived.by(() => {
        if (!isFlying || !animatingPlayer || !animatingPlayerTeam) {
            return '';
        }

        const teamColor = animatingPlayerTeam.split(' ')[0].toLowerCase();
        const teamStyle = teamStyles[teamColor] || teamStyles.default || teamStyles.blue;
        return `${teamStyle.text} ${teamStyle.border} ${flyingPlayerScale}`;
    });

    // Current pots state (keep all players, no mutation)
    let currentPots = $derived.by(() => {
        if (!drawHistory?.initialPots) return [];
        return drawHistory.initialPots;
    });

    // Check which players have completed their animations (for fade/strikethrough)
    let assignedPlayers = $derived.by(() => {
        return completedAnimations;
    });

    // Current teams state (players get added as they're assigned, using completedSteps for delayed updates)
    let currentTeams = $derived.by(() => {
        if (!drawHistory?.drawHistory) return {};

        // Get all unique team names and their target sizes from the full draw history
        const teamSizes = {};
        drawHistory.drawHistory.forEach((step) => {
            if (!teamSizes[step.toTeam]) {
                // Count how many players this team should have in total
                teamSizes[step.toTeam] = drawHistory.drawHistory.filter(
                    (s) => s.toTeam === step.toTeam
                ).length;
            }
        });

        // Initialize teams with correct sizes filled with nulls
        const teams = {};
        Object.entries(teamSizes).forEach(([teamName, size]) => {
            teams[teamName] = new Array(size).fill(null);
        });

        // Fill in assigned players at their correct positions (using completedSteps)
        for (let i = 0; i < completedSteps; i++) {
            const step = drawHistory.drawHistory[i];
            if (step && teams[step.toTeam]) {
                // Find first null slot and assign the player
                const nullIndex = teams[step.toTeam].findIndex((slot) => slot === null);
                if (nullIndex !== -1) {
                    teams[step.toTeam][nullIndex] = step.player;
                }
            }
        }

        return teams;
    });

    function play() {
        if (currentStep >= drawHistory.drawHistory.length) {
            currentStep = 0;
        }

        isPlaying = true;
        nextStep();
    }

    function pause() {
        isPlaying = false;
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    function nextStep() {
        if (currentStep >= drawHistory.drawHistory.length) return;

        const step = drawHistory.drawHistory[currentStep];

        // Start pulse animation in pot
        animatingPlayer = step.player;
        animatingPlayerTeam = step.toTeam;

        // Start flying animation after a short delay
        createTimeout(() => {
            startFlyingAnimation(step.player, step.toTeam, step.fromPot);
            // Fire confetti towards the end of the flying animation when player lands
            fireStepConfetti(step.toTeam);
        }, 400);

        createTimeout(() => {
            animatingPlayer = null;
            animatingPlayerTeam = null;
            // Add to completed animations after animation finishes
            completedAnimations.add(step.player);
            completedAnimations = completedAnimations; // Trigger reactivity
            // Update completed steps to fill team tables
            completedSteps++;

            // Add a small gap before next step
            createTimeout(() => {
                // Continue with next step if playing
                if (isPlaying && currentStep < drawHistory.drawHistory.length) {
                    nextStep();
                } else if (currentStep >= drawHistory.drawHistory.length) {
                    pause();
                }
            }, 300); // 300ms gap between steps
        }, 1600); // Extended to ensure flying animation completes

        // Increment step counter immediately for tracking
        currentStep++;
    }

    function startFlyingAnimation(playerName, teamName, fromPot) {
        // Enable flying state (player/team already set in animatingPlayer/Team)
        isFlying = true;

        // Calculate starting position (pot center)
        const potElement = document.querySelector(`.pot:nth-child(${fromPot + 1})`);
        const startRect = potElement?.getBoundingClientRect();

        if (startRect) {
            const containerRect = document
                .querySelector('.draw-replay-container')
                .getBoundingClientRect();

            // Start position (relative to container)
            const startX = startRect.left - containerRect.left + startRect.width / 2 - 40;
            const startY = startRect.top - containerRect.top + startRect.height / 2 - 15;

            // Center position
            const centerX = containerRect.width / 2 - 40;
            const centerY = containerRect.height / 2 - 15;

            // End position (team table center - approximate)
            const teamElements = document.querySelectorAll('.teams-container > div');
            const teamIndex = Object.keys(currentTeams).indexOf(teamName);
            const endElement = teamElements[teamIndex];
            const endRect = endElement?.getBoundingClientRect();

            const endX = endRect
                ? endRect.left - containerRect.left + endRect.width / 2 - 40
                : centerX;
            const endY = endRect
                ? endRect.top - containerRect.top + endRect.height / 2 - 15
                : centerY + 50;

            // Set initial position
            flyingPlayerPosition = { x: startX, y: startY };
            flyingPlayerScale = 'scale-100';

            // Animate directly to team (with scale up in middle of journey)
            createTimeout(() => {
                flyingPlayerPosition = { x: endX, y: endY };
                flyingPlayerScale = 'scale-[2.5]';
            }, 100);

            // Scale back down while at destination
            createTimeout(() => {
                flyingPlayerScale = 'scale-100';
            }, 700);

            // Clear flying state
            createTimeout(() => {
                isFlying = false;
            }, 1400);
        }
    }

    function previousStep() {
        if (currentStep <= 0) return;
        currentStep--;
        completedSteps--;
        // Rebuild completedAnimations based on completedSteps
        const newCompleted = new SvelteSet();
        for (let i = 0; i < completedSteps; i++) {
            const step = drawHistory.drawHistory[i];
            if (step) {
                newCompleted.add(step.player);
            }
        }
        completedAnimations = newCompleted;
    }

    function reset() {
        pause();
        clearAllTimeouts();
        currentStep = 0;
        completedSteps = 0;
        completedAnimations = new SvelteSet();
        isFlying = false;
        animatingPlayer = null;
        animatingPlayerTeam = null;
    }

    // Helper function to track timeouts for cleanup
    function createTimeout(callback, delay) {
        const timeoutId = setTimeout(callback, delay);
        activeTimeouts.push(timeoutId);
        return timeoutId;
    }

    // Clear all active timeouts
    function clearAllTimeouts() {
        activeTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
        activeTimeouts = [];
    }

    // Fire a short confetti burst in team colors
    function fireStepConfetti(teamName) {
        const teamColor = teamName.split(' ')[0].toLowerCase();
        const teamStyle = teamStyles[teamColor] || teamStyles.default || teamStyles.blue;
        const colors = teamStyle.confetti || ['#999999', '#ffffff'];

        const end = Date.now() + 0.2 * 1000; // 0.2 seconds instead of 0.5

        // Create confetti canvas attached to the modal container
        const container = document.querySelector('.draw-replay-container');
        if (!container) return;

        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10';
        container.appendChild(canvas);

        const myConfetti = confetti.create(canvas, {
            resize: true,
            useWorker: true
        });

        // Calculate the origin based on the flying player position (as fractions 0-1)
        const containerRect = container.getBoundingClientRect();
        const originX = (flyingPlayerPosition.x + 40) / container.offsetWidth; // +40 to get center of player div
        const originY = (flyingPlayerPosition.y + 15) / container.offsetHeight; // +15 to get center of player div

        // Shoot stars effect with team colors
        const defaults = {
            spread: 360,
            ticks: 50,
            gravity: 0.9,
            decay: 0.94,
            startVelocity: 30,
            colors: colors,
            origin: { x: originX, y: originY }
        };

        function shoot() {
            myConfetti({
                ...defaults,
                particleCount: 20, // Reduced from 40 for shorter burst
                scalar: 1.2,
                shapes: ['star']
            });

            myConfetti({
                ...defaults,
                particleCount: 40, // Reduced from 80 for shorter burst
                scalar: 0.75,
                shapes: ['circle']
            });
        }

        // Fire 3 bursts with small delays
        setTimeout(shoot, 100);
        setTimeout(shoot, 200);

        // Clean up the canvas after animation
        setTimeout(() => {
            if (container.contains(canvas)) {
                container.removeChild(canvas);
            }
        }, 1000);
    }

    onMount(() => {
        return () => {
            if (intervalId) clearInterval(intervalId);
            clearAllTimeouts();
        };
    });
</script>

<Modal
    bind:open
    fullscreen
    class="h-full overflow-hidden p-0"
    classes={{
        body: 'bg-white dark:bg-gray-800 p-0 h-full'
    }}
    onaction={() => {
        // Reset to initial state when opening
        reset();
    }}
    onclose={() => {
        // Clean up when closing
        reset();
    }}>
    <div class="draw-replay-container relative overflow-hidden p-2">
        <!-- Flying Player Animation -->
        {#if isFlying && animatingPlayer}
            <div
                class="pointer-events-none absolute z-50 origin-center transform rounded-lg transition-all duration-[1400ms] ease-in-out {flyingPlayerClasses}"
                style="left: {flyingPlayerPosition.x}px; top: {flyingPlayerPosition.y}px;"
                transition:fade>
                <div class="rounded-lg px-4 py-2 text-sm font-bold shadow-xl">
                    {animatingPlayer}
                </div>
            </div>
        {/if}

        <div class="mb-2 flex items-center justify-between">
            <h3 class="text-lg font-semibold">Team Draw Replay</h3>
        </div>

        <div class="controls mb-2 flex w-full items-center gap-2">
            <ButtonGroup>
                <Button
                    id="play-button"
                    size="xs"
                    onclick={isPlaying ? pause : play}>
                    {#if isPlaying}
                        <PauseSolid class="h-4 w-4" />
                    {:else}
                        <PlaySolid class="h-4 w-4" />
                    {/if}
                </Button>

                <Button
                    id="previous-button"
                    size="xs"
                    onclick={previousStep}
                    disabled={currentStep <= 0}>
                    <BackwardStepSolid class="h-4 w-4" />
                </Button>

                <Button
                    id="next-button"
                    size="xs"
                    onclick={nextStep}
                    disabled={currentStep >= drawHistory.drawHistory.length}>
                    <ForwardStepSolid class="h-4 w-4" />
                </Button>

                <Button
                    size="xs"
                    onclick={reset}
                    id="reset-button">
                    <ArrowRotateIcon class="!h-3 !w-3" />
                </Button>
            </ButtonGroup>
            <Tooltip
                triggeredBy="#play-button"
                transition={scale}
                class="shadow-lg">{isPlaying ? 'Pause' : 'Play'}</Tooltip>
            <Tooltip
                triggeredBy="#previous-button"
                transition={scale}
                class="shadow-lg">Previous</Tooltip>
            <Tooltip
                triggeredBy="#next-button"
                transition={scale}
                class="shadow-lg">Next</Tooltip>
            <Tooltip
                triggeredBy="#reset-button"
                transition={scale}
                class="shadow-lg">Reset</Tooltip>
        </div>

        <!-- Pots Section -->
        <div class="pots-section mb-2">
            <div
                class="pots-container flex gap-2"
                style="width: 100%;">
                {#each currentPots as pot, potIndex (potIndex)}
                    <div class="pot min-w-0 flex-1">
                        <Listgroup class="shadow-lg">
                            <ListgroupItem
                                class="bg-gray-400 px-2 py-1 text-xs font-bold text-gray-900 uppercase dark:bg-gray-500 dark:text-gray-200"
                                >{pot.name}</ListgroupItem>
                            {#each pot.players as player (player.name)}
                                <ListgroupItem
                                    class={`px-2 py-1 text-xs transition-all duration-500 ${
                                        animatingPlayer === player.name
                                            ? animatingPlayerClasses
                                            : ''
                                    } ${assignedPlayers.has(player.name) ? 'line-through opacity-50' : ''}`}>
                                    <div class="flex w-full items-center justify-between">
                                        <div
                                            class="mr-1 flex-1 overflow-hidden font-normal text-ellipsis whitespace-nowrap">
                                            {player.name}
                                        </div>
                                        {#if player.rankingPoints !== null}
                                            <div
                                                class="text-xs font-light whitespace-nowrap opacity-70">
                                                {player.rankingPoints}
                                            </div>
                                        {/if}
                                    </div>
                                </ListgroupItem>
                            {/each}
                        </Listgroup>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Teams Section -->
        <div class="teams-section">
            <div class="teams-container grid grid-cols-2 gap-2">
                {#each Object.entries(currentTeams) as [teamName, players], i (i)}
                    <TeamTable
                        team={players}
                        {teamName}
                        color={teamName.split(' ')[0].toLowerCase()}
                        canModifyList={false}
                        onremove={null}
                        onassign={null}
                        assignablePlayers={[]}
                        size="sm" />
                {/each}
            </div>
        </div>
    </div>
</Modal>

<style>
    .draw-replay-container {
        min-height: 400px;
    }

    .pots-container,
    .teams-container {
        overflow-y: auto;
    }

    .pot {
        min-width: 0; /* Allow flex items to shrink below content size */
    }

    @keyframes bounce {
        0%,
        20%,
        53%,
        80%,
        100% {
            animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
            transform: translate3d(0, 0, 0);
        }
        40%,
        43% {
            animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
            transform: translate3d(0, -8px, 0);
        }
        70% {
            animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
            transform: translate3d(0, -4px, 0);
        }
        90% {
            transform: translate3d(0, -1px, 0);
        }
    }
</style>
