<script>
    import { Button } from 'flowbite-svelte';
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md text-center">
        <div class="mb-8">
            <h1 class="mb-2 text-6xl font-bold text-gray-900">⚽</h1>
            <h2 class="mb-4 text-3xl font-bold text-gray-900">League Not Found</h2>
            <p class="text-lg text-gray-600">
                The league you're looking for doesn't exist or hasn't been set up yet.
            </p>
        </div>

        <div class="space-y-4">
            <Button
                href="http://leagr.local:5173"
                class="w-full">
                Go to Main League
            </Button>

            <p class="text-sm text-gray-500">
                Need to create a new league? Contact your administrator.
            </p>
        </div>
    </div>
</div>
