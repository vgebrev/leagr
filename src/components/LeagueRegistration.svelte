<script>
    import { Alert, Button, Input, Label, Radio } from 'flowbite-svelte';
    import LeagueIcon from './LeagueIcon.svelte';
    import { isValidSubdomain, generateAccessCode } from '$lib/shared/validation.js';
    import { capitalize } from '$lib/shared/helpers.js';
    import { leaguesService } from '$lib/client/services/leagues.svelte.js';
    import { page } from '$app/state';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { CirclePlusSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { withLoading } from '$lib/client/stores/loading.js';

    let {
        leagueId = null, // null for new league, string for existing subdomain
        mode = leagueId ? 'existing' : 'new' // 'new' or 'existing'
    } = $props();

    // Form state
    let subdomain = $state(leagueId || '');
    let name = $state(capitalize(leagueId || ''));
    let icon = $state('soccer');
    let accessCode = $state(generateAccessCode());
    let ownerEmail = $state('');

    // Dynamic URL parts from current page
    let urlProtocol = $derived(page.url.protocol);
    let urlHost = $derived.by(() => {
        const hostname = page.url.hostname;
        const port = page.url.port;

        // Extract the base domain (everything after the first subdomain)
        const parts = hostname.split('.');
        const baseDomain = parts.length > 2 ? parts.slice(1).join('.') : hostname;

        return port ? `${baseDomain}:${port}` : baseDomain;
    });

    // Available icons
    const iconOptions = [
        'soccer',
        'trophy',
        'medal',
        'crown',
        'shield',
        'skull',
        'star',
        'smile',
        'hand',
        'poo'
    ];

    // Validation
    let subdomainError = $derived.by(() => {
        if (mode === 'new' && subdomain) {
            if (!isValidSubdomain(subdomain)) {
                return 'Invalid subdomain. Use only letters, numbers, and hyphens.';
            }
        }
        return '';
    });

    async function handleSubmit(event) {
        event.preventDefault();
        // Validate form
        if (!subdomain) {
            setNotification('Please enter a subdomain for your league', 'warning');
            return;
        }

        if (!name) {
            setNotification('Please enter a name for your league', 'warning');
            return;
        }

        if (!icon) {
            setNotification('Please select an icon for your league', 'warning');
            return;
        }

        if (!accessCode) {
            setNotification('Please provide an access code for your league', 'warning');
            return;
        }

        if (subdomainError) {
            setNotification(subdomainError, 'error');
            return;
        }

        await withLoading(
            async () => {
                await leaguesService.createLeague({
                    subdomain,
                    name,
                    icon,
                    accessCode,
                    ownerEmail: ownerEmail.trim() || undefined
                });

                setNotification('League created successfully! Redirecting...', 'success');

                // Redirect to the new league after a short delay
                setTimeout(() => {
                    window.location.href = `${urlProtocol}//${subdomain}.${urlHost}`;
                }, 2000);
            },
            (err) => {
                setNotification(err.message, 'error');
            }
        );
    }

    function regenerateAccessCode() {
        accessCode = generateAccessCode();
    }
</script>

<div class="mb-2 text-center">
    <h1 class="mb-2 font-bold text-gray-900 dark:text-white">
        {mode === 'new' ? 'Create New League' : 'Register League'}
    </h1>
    <p class="text-gray-600 dark:text-gray-400">
        {mode === 'new'
            ? 'Set up your own social league.'
            : `The league "${leagueId}" doesn't exist yet. Register it now!`}
    </p>
</div>

<form
    onsubmit={handleSubmit}
    class="space-y-6">
    <!-- Subdomain -->
    <div>
        <Label
            for="subdomain"
            class="mb-2 text-sm font-medium text-gray-900 dark:text-white">League URL</Label>
        <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">{urlProtocol}//</span>
            <Input
                id="subdomain"
                type="text"
                bind:value={subdomain}
                placeholder="your-league"
                disabled={mode === 'existing'}
                wrapperClass="w-full flex-1"
                required />
            <span class="text-sm text-gray-500 dark:text-gray-400">.{urlHost}</span>
        </div>
        {#if subdomainError}
            <p class="mt-2 text-sm text-red-600 dark:text-red-500">{subdomainError}</p>
        {/if}
    </div>

    <!-- League Name -->
    <div>
        <Label
            for="name"
            class="mb-2 text-sm font-medium text-gray-900 dark:text-white">League Name</Label>
        <Input
            id="name"
            type="text"
            bind:value={name}
            placeholder="Your League"
            required />
    </div>

    <!-- Icon Selection -->
    <div>
        <Label class="mb-2 text-sm font-medium text-gray-900 dark:text-white">League Icon</Label>
        <div class="grid grid-cols-5 gap-2">
            {#each iconOptions as option, i (i)}
                <label
                    class="flex cursor-pointer flex-col items-center rounded-lg border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 {icon ===
                    option
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'}">
                    <Radio
                        name="icon"
                        value={option}
                        bind:group={icon}
                        class="sr-only" />
                    <LeagueIcon
                        icon={option}
                        class="mb-1 h-6 w-6" />
                </label>
            {/each}
        </div>
    </div>

    <!-- Access Code -->
    <div>
        <Label
            for="accessCode"
            class="mb-2 text-sm font-medium text-gray-900 dark:text-white">Access Code</Label>
        <div class="flex w-full items-center space-x-2">
            <Input
                id="accessCode"
                type="text"
                bind:value={accessCode}
                placeholder="XXXX-XXXX-XXXX"
                wrapperClass="flex-1 font-mono"
                required />
            <Button
                type="button"
                color="alternative"
                size="sm"
                onclick={regenerateAccessCode}>
                Generate
            </Button>
        </div>
        <Alert class="mt-2 flex items-center border">
            <ExclamationCircleSolid /><span>
                <span class="font-bold">Important!</span> Remember this code and share it with players
                to join your league!</span>
        </Alert>
    </div>

    <!-- Owner Email (Optional) -->
    <div>
        <Label
            for="ownerEmail"
            class="mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >Owner Email <span class="text-gray-400">(optional)</span></Label>
        <Input
            id="ownerEmail"
            type="email"
            bind:value={ownerEmail}
            placeholder="your.email@example.com" />
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Used for access code recovery if you forget it
        </p>
    </div>

    <!-- Submit Button -->
    <Button
        type="submit"
        class="w-full">
        <CirclePlusSolid class="me-2 h-4 w-4" />
        Create League
    </Button>
</form>
