import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Enable optional polling for file watching when working across WSL/Windows filesystems.
// Set USE_POLLING=true in your environment to turn this on when needed.
const usePolling = process.env.USE_POLLING === 'true';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        allowedHosts: ['localhost', '.leagr.local', '.leagr.dev.local'],
        hmr: {
            // Helpful in WSL to ensure the browser connects back on the right port
            clientPort: 5173
        },
        watch: {
            ignored: ['**/data/**'],
            usePolling,
            interval: usePolling ? 100 : undefined
        }
    }
});
