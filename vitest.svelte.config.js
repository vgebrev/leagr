import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['test/**/*.svelte.{test,spec}.{js,ts}'],
        exclude: ['node_modules', '.svelte-kit']
    },
    resolve: {
        alias: {
            $lib: new URL('./src/lib', import.meta.url).pathname
        }
    }
});
