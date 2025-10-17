<script>
    import Avatar from './Avatar.svelte';
    import { Alert, Button, ButtonGroup, Card } from 'flowbite-svelte';
    import { CheckOutline, CloseOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';

    let pending = $state([]);
    let loadingError = $state(false);

    /**
     * Load pending avatars from API
     */
    async function loadPendingAvatars() {
        loadingError = false;
        await withLoading(
            async () => {
                const response = await api.get('players/pending-avatars');
                pending = response.pending || [];
            },
            (err) => {
                console.error('Error loading pending avatars:', err);
                loadingError = true;
                setNotification(err.message || 'Failed to load pending avatars.', 'error');
            }
        );
    }

    /**
     * Approve an avatar
     */
    async function approve(playerName) {
        await withLoading(
            async () => {
                await api.patchDirect(`rankings/${encodeURIComponent(playerName)}/avatar`, {
                    status: 'approved'
                });
                setNotification(`Avatar approved for ${playerName}`, 'success');
                await loadPendingAvatars(); // Refresh list
            },
            (err) => {
                console.error('Error approving avatar:', err);
                setNotification(err.message || 'Failed to approve avatar.', 'error');
            }
        );
    }

    /**
     * Reject an avatar
     */
    async function reject(playerName) {
        await withLoading(
            async () => {
                await api.patchDirect(`rankings/${encodeURIComponent(playerName)}/avatar`, {
                    status: 'rejected'
                });
                setNotification(`Avatar rejected for ${playerName}`, 'info');
                await loadPendingAvatars(); // Refresh list
            },
            (err) => {
                console.error('Error rejecting avatar:', err);
                setNotification(err.message || 'Failed to reject avatar.', 'error');
            }
        );
    }

    onMount(loadPendingAvatars);
</script>

{#if loadingError}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load pending avatars. Please try again.</span>
    </Alert>
{:else if pending.length === 0}
    <div class="text-center text-gray-500 dark:text-gray-400">No pending avatars to review</div>
{:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each pending as { name } (name)}
            <Card class="flex flex-col items-center gap-4 p-4">
                <Avatar
                    avatarUrl={`/api/rankings/${encodeURIComponent(name)}/avatar`}
                    status="pending"
                    forceShow={true}
                    size="xl" />
                <p class="text-center font-semibold">{name}</p>
                <ButtonGroup class="w-full">
                    <Button
                        color="green"
                        class="flex-1"
                        onclick={() => approve(name)}>
                        <CheckOutline class="me-2 h-4 w-4" />
                        Approve
                    </Button>
                    <Button
                        color="red"
                        class="flex-1"
                        onclick={() => reject(name)}>
                        <CloseOutline class="me-2 h-4 w-4" />
                        Reject
                    </Button>
                </ButtonGroup>
            </Card>
        {/each}
    </div>
{/if}
