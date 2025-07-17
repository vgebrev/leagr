<script>
    import { Button, Input, Label } from 'flowbite-svelte';
    import { LockOpenSolid, LockSolid } from 'flowbite-svelte-icons';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import {
        storeAccessCode,
        isAuthenticated,
        validateAccessCode
    } from '$lib/client/services/auth.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';

    let { data } = $props();
    let accessCode = $state('');

    // Get redirect URL from query params
    let redirectUrl = $derived(page.url.searchParams.get('redirect') || '/');

    // Redirect if already authenticated or no league
    onMount(() => {
        if (!data.leagueInfo) {
            goto('/');
            return;
        }

        const authenticated = isAuthenticated(data.leagueId);
        if (authenticated) {
            goto(redirectUrl);
        }
    });

    async function handleSubmit(event) {
        event.preventDefault();

        await withLoading(async () => {
            // Simple validation
            if (!accessCode.trim()) {
                setNotification('Please enter an access code', 'error');
                return;
            }

            // Validate with server
            const isValid = await validateAccessCode(accessCode.trim());

            if (isValid) {
                // Store the code and redirect
                storeAccessCode(data.leagueId, accessCode.trim());
                setNotification('Authentication successful!', 'success');
                goto(redirectUrl);
            } else {
                setNotification('Invalid access code. Please try again.', 'error');
            }
        });
    }
</script>

<div class="flex min-h-full w-full flex-col items-center justify-center">
    <div class="mb-6 text-center">
        <LockSolid class="text-primary-600 mx-auto mb-4 h-16 w-16" />
        <h1 class="text-lg font-bold text-gray-900 dark:text-white">League Access Required</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter the access code for <strong>{data.leagueInfo?.name || 'this league'}</strong>
        </p>
    </div>

    <form
        onsubmit={handleSubmit}
        class="w-full space-y-4">
        <div>
            <Label
                for="access-code"
                class="mb-2">Access Code</Label>
            <Input
                id="access-code"
                type="text"
                bind:value={accessCode}
                placeholder="Enter access code"
                required
                wrapperClass="w-full font-mono" />
        </div>

        <Button
            type="submit"
            color="primary"
            class="w-full">
            <LockOpenSolid class="mr-2 h-4 w-4" />
            Enter League
        </Button>
    </form>

    <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
            <a
                href="/auth/forgot"
                class="text-primary-600 hover:underline">
                Forgotten access code?
            </a>
        </p>
        <p class="mt-2">Need help? Contact the league organiser for the access code.</p>
    </div>
</div>
