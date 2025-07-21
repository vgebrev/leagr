<script>
    import { Button, Input, Label, Alert } from 'flowbite-svelte';
    import { LockSolid, EnvelopeSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { leaguesService } from '$lib/client/services/leagues.svelte.js';

    let { data } = $props();
    let email = $state('');
    let hasOwnerEmail = $state(data.leagueInfo?.hasOwnerEmail || false);

    onMount(() => {
        if (!data.leagueInfo) {
            goto('/');
        }
    });

    async function handleSubmit(event) {
        event.preventDefault();

        if (!email.trim()) {
            setNotification('Please enter your email address', 'error');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setNotification('Please enter a valid email address', 'error');
            return;
        }

        await withLoading(
            async () => {
                await leaguesService.forgotAccessCode(email.trim());
                setNotification('A reset link has been sent to the league organiser.', 'success');
                // Don't redirect immediately - let user read the message
            },
            (error) => {
                console.error('Error requesting reset code:', error);
                setNotification(error.message || 'Failed to send reset email', 'error');
            }
        );
    }
</script>

<div class="flex min-h-full w-full flex-col items-center justify-center gap-2">
    <div class="mb-2 text-center">
        <LockSolid class="text-primary-600 mx-auto mb-4 h-16 w-16" />
        <h1 class="text-lg font-bold text-gray-900 dark:text-white">Forgot Access Code</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Reset your access code for <strong>{data.leagueInfo?.name || 'this league'}</strong>
        </p>
    </div>

    {#if !hasOwnerEmail}
        <Alert class="flex items-center border">
            <ExclamationCircleSolid /><span>
                This league doesn't have an organiser email configured. Access code reset is not
                available.
            </span>
        </Alert>

        <Button
            color="primary"
            href="/auth"
            class="w-full">
            Return to Login
        </Button>
    {:else}
        <Alert class="flex items-center border">
            <ExclamationCircleSolid /><span>
                Only the league organiser can reset the access code. If you're not the organiser,
                please contact them for the access code or share link.
            </span>
        </Alert>
        <form
            onsubmit={handleSubmit}
            class="w-full space-y-4">
            <div>
                <Label
                    for="email"
                    class="mb-2">Organiser Email</Label>
                <Input
                    id="email"
                    type="email"
                    bind:value={email}
                    placeholder="your.email@example.com"
                    required
                    classes={{ wrapper: 'w-full' }} />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Enter the email address associated with this league
                </p>
            </div>

            <Button
                type="submit"
                color="primary"
                class="w-full">
                <EnvelopeSolid class="mr-2 h-4 w-4" />
                Send Reset Link
            </Button>
        </form>

        <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>
                <a
                    href="/auth"
                    class="text-primary-600 hover:underline">
                    Remember your code? Back to login
                </a>
            </p>
        </div>
    {/if}
</div>
