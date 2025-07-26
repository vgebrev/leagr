import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['test/**/*.svelte.{test,spec}.{js,ts}'],
        exclude: ['node_modules', '.svelte-kit'],
        setupFiles: ['test/setup.svelte.js']
    },
    resolve: {
        alias: {
            $lib: new URL('./src/lib', import.meta.url).pathname,
            $src: new URL('./src', import.meta.url).pathname,
            $test: new URL('./test', import.meta.url).pathname
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
