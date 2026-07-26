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

// jsdom implements neither of these; the match timer touches both.
if (!navigator.vibrate) {
    Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        value: vi.fn().mockReturnValue(true)
    });
}

global.AudioContext = vi.fn().mockImplementation(() => ({
    state: 'running',
    currentTime: 0,
    destination: {},
    sampleRate: 48000,
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
    })),
    createGain: vi.fn(() => ({
        gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn()
    })),
    createBiquadFilter: vi.fn(() => ({
        type: 'bandpass',
        frequency: { value: 0, setValueAtTime: vi.fn() },
        Q: { value: 0 },
        connect: vi.fn()
    })),
    createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
    })),
    createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(128))
    }))
}));

// Mock URL for SvelteKit environments
global.URL = global.URL || URL;

// Set up common test environment variables
vi.stubEnv('NODE_ENV', 'test');

// Ensure Svelte runs in browser mode
vi.stubEnv('VITEST', 'true');
