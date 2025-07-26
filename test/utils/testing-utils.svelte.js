import { render } from '@testing-library/svelte';
import { vi } from 'vitest';

/**
 * Enhanced render function for Svelte 5 components with common test setup
 */
export function renderComponent(Component, options = {}) {
    const defaultOptions = {
        props: {},
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        context: new Map(),
        ...options
    };

    return render(Component, defaultOptions);
}

/**
 * Create a mock for Svelte 5 service classes
 */
export function createMockService(serviceName, methods = {}) {
    const mock = {};

    // Add default methods that most services have
    const defaultMethods = {
        load: vi.fn().mockResolvedValue(undefined),
        reload: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn(),
        ...methods
    };

    Object.keys(defaultMethods).forEach((method) => {
        mock[method] = defaultMethods[method];
    });

    return mock;
}

/**
 * Mock API responses for testing
 */
export function mockApiResponse(data, status = 200) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: vi.fn().mockResolvedValue(data),
        text: vi.fn().mockResolvedValue(JSON.stringify(data))
    });
}

/**
 * Create mock fetch responses
 */
export function setupMockFetch(responses = []) {
    const mockFetch = vi.fn();

    responses.forEach((response) => {
        mockFetch.mockResolvedValueOnce({
            ok: response.status >= 200 && response.status < 300,
            status: response.status || 200,
            json: vi.fn().mockResolvedValue(response.data),
            text: vi.fn().mockResolvedValue(JSON.stringify(response.data))
        });
    });

    global.fetch = mockFetch;
    return mockFetch;
}

/**
 * Wait for Svelte reactive updates to complete
 */
export function tick() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create mock context for testing components that use getContext
 */
export function createMockContext(contextMap = {}) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const context = new Map();
    Object.entries(contextMap).forEach(([key, value]) => {
        context.set(key, value);
    });
    return context;
}

/**
 * Helper to trigger reactive state updates in tests
 */
export async function updateReactiveState(callback) {
    callback();
    await tick();
}

/**
 * Mock validation results for form testing
 */
export function createMockValidation(isValid = true, errors = []) {
    return {
        isValid,
        sanitizedName: isValid ? 'Test Player' : '',
        errors,
        errorMessage: errors[0] || ''
    };
}
