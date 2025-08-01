import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock the notification store
vi.mock('$lib/client/stores/notification.js', () => ({
    setNotification: vi.fn()
}));

describe('Loading Store', () => {
    let loadingCount, isLoading, pushLoading, popLoading, withLoading;

    beforeEach(async () => {
        // Clear the module cache to get fresh instances
        vi.resetModules();

        const loadingModule = await import('$lib/client/stores/loading.js');

        loadingCount = loadingModule.loadingCount;
        isLoading = loadingModule.isLoading;
        pushLoading = loadingModule.pushLoading;
        popLoading = loadingModule.popLoading;
        withLoading = loadingModule.withLoading;

        // Reset loading count to 0
        loadingCount.set(0);
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up after each test
        loadingCount.set(0);
    });

    describe('loadingCount store', () => {
        it('should initialize with count 0', () => {
            expect(get(loadingCount)).toBe(0);
        });

        it('should update when set', () => {
            loadingCount.set(5);
            expect(get(loadingCount)).toBe(5);
        });
    });

    describe('isLoading derived store', () => {
        it('should be false when count is 0', () => {
            loadingCount.set(0);
            expect(get(isLoading)).toBe(false);
        });

        it('should be true when count is greater than 0', () => {
            loadingCount.set(1);
            expect(get(isLoading)).toBe(true);

            loadingCount.set(5);
            expect(get(isLoading)).toBe(true);
        });

        it('should react to loadingCount changes', () => {
            loadingCount.set(0);
            expect(get(isLoading)).toBe(false);

            loadingCount.set(1);
            expect(get(isLoading)).toBe(true);

            loadingCount.set(0);
            expect(get(isLoading)).toBe(false);
        });
    });

    describe('pushLoading', () => {
        it('should increment loading count by 1', () => {
            expect(get(loadingCount)).toBe(0);

            pushLoading();
            expect(get(loadingCount)).toBe(1);

            pushLoading();
            expect(get(loadingCount)).toBe(2);
        });
    });

    describe('popLoading', () => {
        it('should decrement loading count by 1', () => {
            loadingCount.set(3);

            popLoading();
            expect(get(loadingCount)).toBe(2);

            popLoading();
            expect(get(loadingCount)).toBe(1);
        });

        it('should not go below 0', () => {
            loadingCount.set(1);

            popLoading();
            expect(get(loadingCount)).toBe(0);

            popLoading();
            expect(get(loadingCount)).toBe(0);

            popLoading();
            expect(get(loadingCount)).toBe(0);
        });
    });

    describe('withLoading', () => {
        it('should handle successful function execution', async () => {
            const mockFn = vi.fn().mockResolvedValue('success');

            expect(get(loadingCount)).toBe(0);

            const result = await withLoading(mockFn);

            expect(mockFn).toHaveBeenCalledOnce();
            expect(result).toBe('success');
            expect(get(loadingCount)).toBe(0); // Should be back to 0 after completion
        });

        it('should increment loading count during execution', async () => {
            let loadingCountDuringExecution;

            const mockFn = vi.fn().mockImplementation(async () => {
                loadingCountDuringExecution = get(loadingCount);
                return 'success';
            });

            expect(get(loadingCount)).toBe(0);

            await withLoading(mockFn);

            expect(loadingCountDuringExecution).toBe(1);
            expect(get(loadingCount)).toBe(0);
        });

        it('should handle errors with custom error handler', async () => {
            const error = new Error('Test error');
            const mockFn = vi.fn().mockRejectedValue(error);
            const mockErrorHandler = vi.fn();

            await withLoading(mockFn, mockErrorHandler);

            expect(mockFn).toHaveBeenCalledOnce();
            expect(mockErrorHandler).toHaveBeenCalledWith(error);
            expect(get(loadingCount)).toBe(0); // Should be back to 0 after error
        });

        it('should handle errors without custom error handler', async () => {
            const error = new Error('Test error');
            const mockFn = vi.fn().mockRejectedValue(error);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await withLoading(mockFn);

            expect(mockFn).toHaveBeenCalledOnce();
            expect(consoleSpy).toHaveBeenCalledWith('Error in withLoading:', error);
            expect(get(loadingCount)).toBe(0); // Should be back to 0 after error

            consoleSpy.mockRestore();
        });

        it('should reset loading count even if function throws', async () => {
            const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

            expect(get(loadingCount)).toBe(0);

            await withLoading(mockFn);

            expect(get(loadingCount)).toBe(0);
        });

        it('should handle multiple concurrent withLoading calls', async () => {
            const delays = [50, 100, 30];
            const mockFns = delays.map((delay) =>
                vi
                    .fn()
                    .mockImplementation(
                        () =>
                            new Promise((resolve) =>
                                setTimeout(() => resolve(`done-${delay}`), delay)
                            )
                    )
            );

            expect(get(loadingCount)).toBe(0);

            // Start all calls concurrently
            const promises = mockFns.map((fn) => withLoading(fn));

            // After a short delay, all should be running
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(get(loadingCount)).toBe(3);

            // Wait for all to complete
            const results = await Promise.all(promises);

            expect(results).toEqual(['done-50', 'done-100', 'done-30']);
            expect(get(loadingCount)).toBe(0);
        });
    });
});
