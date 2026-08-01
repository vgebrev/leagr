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

// jsdom has no Web Animations API, but Svelte transitions call element.animate().
// Finish on the next tick so intro/outro transitions settle instead of hanging.
if (!Element.prototype.animate) {
    Element.prototype.animate = function () {
        const animation = {
            currentTime: 0,
            startTime: 0,
            playState: 'running',
            effect: { getComputedTiming: () => ({ duration: 0 }) },
            onfinish: null,
            play: vi.fn(),
            pause: vi.fn(),
            reverse: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            cancel() {
                this.playState = 'idle';
            },
            finish() {
                this.playState = 'finished';
                this.onfinish?.();
            }
        };
        setTimeout(() => {
            if (animation.playState === 'running') animation.finish();
        }, 0);
        return animation;
    };
}

// Mock IntersectionObserver / ResizeObserver. These must be constructible with `new`
// (floating-ui does exactly that), so they are classes rather than arrow-function mocks.
class ObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
}

global.IntersectionObserver = ObserverStub;
global.ResizeObserver = ObserverStub;

// jsdom implements neither the Popover API nor ToggleEvent; Flowbite's dropdowns,
// tooltips and popovers rely on both.
if (typeof globalThis.ToggleEvent === 'undefined') {
    globalThis.ToggleEvent = class ToggleEvent extends Event {
        constructor(type, init = {}) {
            super(type, init);
            this.newState = init.newState ?? '';
            this.oldState = init.oldState ?? '';
        }
    };
}

if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {
        this.dispatchEvent(new ToggleEvent('toggle', { newState: 'open', oldState: 'closed' }));
    };
    HTMLElement.prototype.hidePopover = function () {
        this.dispatchEvent(new ToggleEvent('toggle', { newState: 'closed', oldState: 'open' }));
    };
    HTMLElement.prototype.togglePopover = function (force) {
        return force ? this.showPopover() : this.hidePopover();
    };
}

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
    })),
    createWaveShaper: vi.fn(() => ({
        curve: null,
        connect: vi.fn()
    }))
}));

// Mock URL for SvelteKit environments
global.URL = global.URL || URL;

// Set up common test environment variables
vi.stubEnv('NODE_ENV', 'test');

// Ensure Svelte runs in browser mode
vi.stubEnv('VITEST', 'true');
