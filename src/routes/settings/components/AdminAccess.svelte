<script>
    import { Button, Input, Label } from 'flowbite-svelte';
    import { ShieldCheckOutline } from 'flowbite-svelte-icons';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import {
        storeAdminCode,
        removeStoredAdminCode,
        validateAdminCode
    } from '$lib/client/services/auth.js';

    let { leagueId, leagueName, onGranted } = $props();

    let adminCode = $state('');

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
        event.preventDefault();
        await withLoading(async () => {
            if (!adminCode.trim()) {
                setNotification('Please enter an admin code', 'error');
                return;
            }

            // Set header + persist, then validate
            storeAdminCode(leagueId, adminCode.trim());
            const ok = await validateAdminCode();

            if (ok) {
                setNotification('Admin privileges claimed for this device.', 'success');
                onGranted?.();
            } else {
                removeStoredAdminCode(leagueId);
                adminCode = '';
                setNotification('Invalid admin code. Please try again.', 'error');
            }
        });
    }
</script>

<div class="flex min-h-full w-full flex-col items-center justify-center">
    <div class="mb-6 text-center">
        <ShieldCheckOutline class="text-primary-600 mx-auto mb-4 h-16 w-16" />
        <h1 class="text-lg font-bold text-gray-900 dark:text-white">Admin Access Required</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Enter the admin code for <strong>{leagueName || 'this league'}</strong>
        </p>
    </div>

    <form
        onsubmit={handleSubmit}
        class="w-full space-y-4">
        <div>
            <Label
                for="admin-code"
                class="mb-2">Admin Code</Label>
            <Input
                id="admin-code"
                type="password"
                bind:value={adminCode}
                placeholder="Enter admin code"
                required
                classes={{ wrapper: 'w-full font-mono' }}
                class="!bg-gray-50 dark:!bg-gray-800" />
        </div>

        <Button
            type="submit"
            color="primary"
            class="w-full">
            <ShieldCheckOutline class="mr-2 h-4 w-4" />
            Claim Admin Access
        </Button>
    </form>
</div>
