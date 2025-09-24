<script>
    import { Button, Input, Label, Alert, Spinner } from 'flowbite-svelte';
    import { LockOpenSolid, LockSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { generateAccessCode } from '$lib/shared/validation.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { leaguesService } from '$lib/client/services/leagues.svelte.js';

    let { data } = $props();
    let newAccessCode = $state('');
    let resetCode = $state('');
    let isValidResetCode = $state(false);
    let hasValidated = $state(false);

    // Get reset code from URL query params
    onMount(() => {
        if (!data.leagueInfo) {
            goto(resolve('/'));
            return;
        }

        const codeFromUrl = page.url.searchParams.get('code');
        if (codeFromUrl) {
            resetCode = codeFromUrl;
            validateResetCode();
        } else {
            hasValidated = true;
            isValidResetCode = false;
        }

        // Pre-populate with a new access code
        newAccessCode = generateAccessCode();
    });

    async function validateResetCode() {
        if (!resetCode.trim()) {
            isValidResetCode = false;
            hasValidated = true;
            return;
        }

        await withLoading(
            async () => {
                await leaguesService.validateResetCode(resetCode.trim());
                isValidResetCode = true;
                hasValidated = true;
            },
            (error) => {
                console.error('Error validating reset code:', error);
                isValidResetCode = false;
                hasValidated = true;
                setNotification('Invalid or expired reset code', 'error');
            }
        );
    }

    /**
     * Handles the form submission to update the access code.
     * @param {SubmitEvent} event
     */
    async function handleSubmit(event) {
        event.preventDefault();

        if (!newAccessCode.trim()) {
            setNotification('Please enter a new access code', 'error');
            return;
        }

        if (!resetCode.trim()) {
            setNotification('Reset code is missing', 'error');
            return;
        }

        await withLoading(
            async () => {
                await leaguesService.resetAccessCode(resetCode.trim(), newAccessCode.trim());
                setNotification('Access code updated successfully!', 'success');
                goto(resolve(`/auth?code=${newAccessCode.trim()}`));
            },
            (error) => {
                console.error('Error updating access code:', error);
                setNotification(error.message || 'Failed to update access code', 'error');
            }
        );
    }

    function generateNewCode() {
        newAccessCode = generateAccessCode();
    }
</script>

<div class="flex min-h-full w-full flex-col items-center justify-center gap-2">
    <div class="mb-2 text-center">
        <LockSolid class="text-primary-600 mx-auto mb-4 h-16 w-16" />
        <h1 class="text-lg font-bold text-gray-900 dark:text-white">Reset Access Code</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Set a new access code for <strong>{data.leagueInfo?.name || 'this league'}</strong>
        </p>
    </div>

    {#if !hasValidated}
        <div class="w-full text-center">
            <Spinner size="6" />
            <p class="text-gray-600 dark:text-gray-300">Validating reset code...</p>
        </div>
    {:else if !isValidResetCode}
        <Alert class="glass flex items-center border">
            <ExclamationCircleSolid /><span>
                This reset link is invalid or has expired. Please <a
                    href={resolve('/auth/forgot')}
                    class="text-primary-600 hover:underline">request a new reset link</a
                >.
            </span>
        </Alert>

        <Button
            color="primary"
            href={resolve('/auth')}
            class="w-full">
            Return to Login
        </Button>
    {:else}
        <form
            onsubmit={handleSubmit}
            class="w-full space-y-4">
            <div>
                <Label
                    for="new-access-code"
                    class="mb-2">New Access Code</Label>
                <div class="flex gap-2">
                    <Input
                        id="new-access-code"
                        type="text"
                        bind:value={newAccessCode}
                        placeholder="Enter new access code"
                        required
                        classes={{ wrapper: 'flex-1 font-mono' }}
                        class="dark:bg-gray-800" />
                    <Button
                        type="button"
                        color="alternative"
                        onclick={generateNewCode}>
                        Generate
                    </Button>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-300">
                    Share this code with league members to access the league
                </p>
            </div>

            <Button
                type="submit"
                color="primary"
                class="w-full">
                <LockOpenSolid class="mr-2 h-4 w-4" />
                Update Access Code
            </Button>
        </form>

        <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-300">
            <p>Make sure to save your new access code securely.</p>
        </div>
    {/if}
</div>
