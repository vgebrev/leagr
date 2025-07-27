import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['test/**/*.svelte.{test,spec}.{js,ts}'],
        exclude: ['node_modules', '.svelte-kit'],
        setupFiles: ['test/setup.svelte.js'],
        silent: false,
        reporter: 'default'
    },
    resolve: {
        alias: {
            $lib: './src/lib',
            $src: './src',
            $test: './test'
        },
        conditions: ['browser']
    },
    define: {
        'import.meta.vitest': false,
        'import.meta.env.SSR': false
    },
    ssr: {
        noExternal: ['@testing-library/svelte']
    }
});
