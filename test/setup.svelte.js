import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global setup for Svelte frontend tests

// Ensure we're in browser mode for Svelte 5
if (typeof global !== 'undefined') {
    global.window = global.window || {};
    global.document = global.document || {};
}

// Mock browser APIs that might not be available in jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
    }))
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
}));

// Mock fetch if not available
if (!global.fetch) {
    global.fetch = vi.fn();
}

// Mock URL for SvelteKit environments
global.URL = global.URL || URL;

// Set up common test environment variables
vi.stubEnv('NODE_ENV', 'test');

// Ensure Svelte runs in browser mode
vi.stubEnv('VITEST', 'true');
