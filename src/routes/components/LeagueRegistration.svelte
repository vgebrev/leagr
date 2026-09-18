<script>
    import { Alert, Button, Input, Label, Radio } from 'flowbite-svelte';
    import { untrack } from 'svelte';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import { isValidSubdomain, generateAccessCode } from '$lib/shared/validation.js';
    import { capitalize, errorMessage } from '$lib/shared/helpers.js';
    import { leaguesService } from '$lib/client/services/leagues.svelte.js';
    import { page } from '$app/state';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { CirclePlusSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { withLoading } from '$lib/client/stores/loading.js';

    let {
        leagueId = null, // null for new league, string for existing subdomain
        mode = leagueId ? 'existing' : 'new', // 'new' or 'existing'
        appUrl
    } = $props();

    // Form state. These are editable fields seeded from the prop, so the initial value is
    // the point - untrack() says that rather than leaving it looking like a missed $derived.
    let subdomain = $state(untrack(() => leagueId) || '');
    let name = $state(capitalize(untrack(() => leagueId) || ''));
    let icon = $state('soccer');
    let accessCode = $state(generateAccessCode());
    let ownerEmail = $state('');
    let adminCode = $state(generateAccessCode());

    // Dynamic URL parts from the current page
    let urlProtocol = $derived(page.url.protocol);
    let urlHost = $derived.by(() => {
        if (!appUrl) {
            // Fallback: only extract the base domain if we're on a subdomain
            const hostname = page.url.hostname;
            const port = page.url.port;

            // If we have a leagueId, we're on a subdomain and need to extract base domain
            // If no leagueId, we're on the root domain and should use the full hostname
            if (leagueId) {
                const parts = hostname.split('.');
                const baseDomain = parts.length > 1 ? parts.slice(1).join('.') : hostname;
                return port ? `${baseDomain}:${port}` : baseDomain;
            } else {
                return port ? `${hostname}:${port}` : hostname;
            }
        }

        // Extract hostname from APP_URL
        const url = new URL(appUrl);
        return url.host; // includes port if present
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
                return 'Invalid league URL. Use only letters, numbers, and hyphens.';
            }
        }
        return '';
    });

    /**
     * Handles the form submission to create or register a league.
     * @param {SubmitEvent} event
     */
    async function handleSubmit(event) {
        event.preventDefault();
        // Validate form
        if (!subdomain) {
            setNotification('Please enter an URL for your league', 'warning');
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
                    adminCode,
                    ownerEmail: ownerEmail.trim() || undefined
                });

                setNotification('League created successfully! Redirecting...', 'success');

                // Redirect to the new league with silent authentication after a short delay
                setTimeout(() => {
                    window.location.href = `${urlProtocol}//${subdomain}.${urlHost}/?code=${encodeURIComponent(accessCode)}`;
                }, 2000);
            },
            (err) => {
                setNotification(errorMessage(err), 'error');
            }
        );
    }

    function regenerateAccessCode() {
        accessCode = generateAccessCode();
    }

    function regenerateAdminCode() {
        adminCode = generateAccessCode();
    }
</script>

<div class="mb-2 text-center">
    <h1 class="mb-2 font-bold text-gray-900 dark:text-white">
        {mode === 'new' ? 'Create New League' : 'Register League'}
    </h1>
    <p class="text-gray-600 dark:text-gray-300">
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
            <span class="text-sm text-gray-500 dark:text-gray-300">{urlProtocol}//</span>
            <Input
                id="subdomain"
                type="text"
                bind:value={subdomain}
                placeholder="your-league"
                disabled={mode === 'existing'}
                classes={{ div: 'w-full flex-1' }}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
            <span class="text-sm text-gray-500 dark:text-gray-300">.{urlHost}</span>
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
            class="!bg-gray-50 dark:!bg-gray-800"
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
                        ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700'}">
                    <Radio
                        name="icon"
                        value={option}
                        bind:group={icon}
                        custom />
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
                classes={{ div: 'flex-1 font-mono' }}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
            <Button
                type="button"
                color="alternative"
                size="sm"
                onclick={regenerateAccessCode}>
                Generate
            </Button>
        </div>
        <Alert class="glass mt-2 flex items-center border">
            <ExclamationCircleSolid /><span>
                <span class="font-bold">Important!</span> Remember this code and share it with players
                to join your league!</span>
        </Alert>
    </div>

    <!-- Admin Code -->
    <div>
        <Label
            for="adminCode"
            class="mb-2 text-sm font-medium text-gray-900 dark:text-white">Admin Code</Label>
        <div class="flex w-full items-center space-x-2">
            <Input
                id="adminCode"
                type="text"
                bind:value={adminCode}
                placeholder="XXXX-XXXX-XXXX"
                classes={{ div: 'flex-1 font-mono' }}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
            <Button
                type="button"
                color="alternative"
                size="sm"
                onclick={regenerateAdminCode}>
                Generate
            </Button>
        </div>
        <Alert class="glass mt-2 flex items-center border">
            <ExclamationCircleSolid /><span>
                <span class="font-bold">Keep this private.</span> This code grants full admin control
                and should not be shared with participants.</span>
        </Alert>
    </div>

    <!-- Owner Email (Optional) -->
    <div>
        <Label
            for="ownerEmail"
            class="mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >Organiser Email <span class="text-gray-400">(optional)</span></Label>
        <Input
            id="ownerEmail"
            type="email"
            bind:value={ownerEmail}
            placeholder="your.email@example.com"
            class="!bg-gray-50 dark:!bg-gray-800" />
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-300">
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
