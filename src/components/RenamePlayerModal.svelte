<script>
    import { Modal, Label, Input, Button } from 'flowbite-svelte';
    import { fade } from 'svelte/transition';
    import { validatePlayerNameForUI } from '$lib/shared/validation.js';
    import { setNotification } from '$lib/client/stores/notification.js';

    let { currentName, allPlayers = [], open = $bindable(false), onrename } = $props();

    let newName = $state('');
    let validationError = $state('');

    // Reset form when modal opens
    $effect(() => {
        if (open) {
            newName = currentName || '';
            validationError = '';
        }
    });

    // Real-time validation as user types
    $effect(() => {
        if (newName && open) {
            if (!newName.trim()) {
                validationError = 'Name cannot be empty';
                return;
            }

            const validation = validatePlayerNameForUI(newName);
            if (!validation.isValid) {
                validationError = validation.errorMessage;
                return;
            }

            if (validation.sanitizedName === currentName) {
                validationError = 'New name must be different from current name';
                return;
            }

            if (allPlayers.includes(validation.sanitizedName)) {
                validationError = `Player ${validation.sanitizedName} already exists`;
                return;
            }

            validationError = '';
        }
    });

    async function handleSubmit(event) {
        event.preventDefault();

        // Validate on submit
        if (!newName || !newName.trim()) {
            setNotification('Name cannot be empty', 'warning');
            return;
        }

        // Validate using the same validation as add player
        const validation = validatePlayerNameForUI(newName);
        if (!validation.isValid) {
            setNotification(validation.errorMessage, 'warning');
            return;
        }

        // Check if name is the same (no change)
        if (validation.sanitizedName === currentName) {
            setNotification('New name must be different from current name', 'warning');
            return;
        }

        // Check if name already exists in the lists
        if (allPlayers.includes(validation.sanitizedName)) {
            setNotification(`Player ${validation.sanitizedName} already exists`, 'warning');
            return;
        }

        try {
            await onrename(currentName, newName.trim());
            open = false;
        } catch (error) {
            // Error already handled by the service
            console.error(error);
        }
    }

    function handleCancel() {
        open = false;
    }
</script>

<Modal
    transition={fade}
    bind:open
    title="Rename Player"
    size="xs"
    autoclose={false}
    outsideclose={false}
    classes={{ header: 'p-4 text-md font-semibold', close: 'p-0' }}>
    <form
        class="flex flex-col gap-4"
        onsubmit={handleSubmit}>
        <div>
            <Label
                for="current-name"
                class="mb-2">Current Name</Label>
            <Input
                id="current-name"
                type="text"
                value={currentName}
                disabled
                class="!bg-gray-100 dark:!bg-gray-700" />
        </div>

        <div>
            <Label
                for="new-name"
                class="mb-2">New Name</Label>
            <Input
                id="new-name"
                type="text"
                bind:value={newName}
                placeholder="Enter new name"
                required
                class="!bg-gray-50 dark:!bg-gray-800"
                autocomplete="off" />
            {#if validationError}
                <p class="mt-2 text-sm text-red-600 dark:text-red-500">{validationError}</p>
            {/if}
        </div>

        <div class="flex gap-2">
            <Button
                type="submit"
                class="flex-1">
                Save
            </Button>
            <Button
                type="button"
                color="alternative"
                onclick={handleCancel}
                class="flex-1">
                Cancel
            </Button>
        </div>
    </form>
</Modal>
