import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.{test,spec}.{js,ts}'],
        exclude: ['node_modules', '.svelte-kit', 'test/**/*.svelte.{test,spec}.{js,ts}']
    },
    resolve: {
        alias: {
            $lib: './src/lib'
        }
    }
});
