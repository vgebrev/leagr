import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

describe('Notification Store', () => {
    let notification, setNotification;

    beforeEach(async () => {
        // Clear module cache to get fresh instances
        vi.resetModules();

        const notificationModule = await import('$lib/client/stores/notification.js');
        notification = notificationModule.notification;
        setNotification = notificationModule.setNotification;

        // Reset notification to null
        notification.set(null);
        vi.clearAllTimers();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        notification.set(null);
    });

    describe('notification store', () => {
        it('should initialize with null value', () => {
            expect(get(notification)).toBeNull();
        });

        it('should update when set manually', () => {
            const testNotification = { message: 'Test', type: 'info' };
            notification.set(testNotification);
            expect(get(notification)).toEqual(testNotification);
        });

        it('should allow subscription to changes', () => {
            const subscriber = vi.fn();
            const unsubscribe = notification.subscribe(subscriber);

            // Should be called immediately with current value
            expect(subscriber).toHaveBeenCalledWith(null);

            const testNotification = { message: 'Test', type: 'info' };
            notification.set(testNotification);

            expect(subscriber).toHaveBeenCalledWith(testNotification);
            expect(subscriber).toHaveBeenCalledTimes(2);

            unsubscribe();
        });
    });

    describe('setNotification', () => {
        it('should set notification with message and default type', () => {
            setNotification('Test message');

            const currentNotification = get(notification);
            expect(currentNotification).toEqual({
                message: 'Test message',
                type: 'error'
            });
        });

        it('should set notification with custom type', () => {
            setNotification('Success message', 'success');

            const currentNotification = get(notification);
            expect(currentNotification).toEqual({
                message: 'Success message',
                type: 'success'
            });
        });

        it('should handle different notification types', () => {
            const types = ['error', 'warning', 'info', 'success'];

            types.forEach((type) => {
                setNotification(`${type} message`, type);

                const currentNotification = get(notification);
                expect(currentNotification).toEqual({
                    message: `${type} message`,
                    type: type
                });
            });
        });

        it('should auto-clear notification after 5 seconds', () => {
            setNotification('Test message', 'info');

            // Should be set initially
            expect(get(notification)).toEqual({
                message: 'Test message',
                type: 'info'
            });

            // Fast-forward time by 4.9 seconds - should still be there
            vi.advanceTimersByTime(4900);
            expect(get(notification)).toEqual({
                message: 'Test message',
                type: 'info'
            });

            // Fast-forward by another 200ms (total 5.1 seconds) - should be cleared
            vi.advanceTimersByTime(200);
            expect(get(notification)).toBeNull();
        });

        it('should handle multiple timers when new notification is set', () => {
            setNotification('First message', 'info');

            // Fast-forward 3 seconds
            vi.advanceTimersByTime(3000);
            expect(get(notification)).toEqual({
                message: 'First message',
                type: 'info'
            });

            // Set new notification (creates a new timer, doesn't cancel first)
            setNotification('Second message', 'warning');
            expect(get(notification)).toEqual({
                message: 'Second message',
                type: 'warning'
            });

            // Fast-forward another 2 seconds (total 5 seconds from first timer)
            // First timer should fire and set notification to null
            vi.advanceTimersByTime(2000);
            expect(get(notification)).toBeNull();

            // Fast-forward another 3 seconds (total 5 seconds from second timer)
            // Second timer should fire but notification is already null
            vi.advanceTimersByTime(3000);
            expect(get(notification)).toBeNull();
        });

        it('should handle rapid successive notifications', () => {
            setNotification('Message 1', 'info');
            setNotification('Message 2', 'warning');
            setNotification('Message 3', 'error');

            // Should show the last message
            expect(get(notification)).toEqual({
                message: 'Message 3',
                type: 'error'
            });

            // Should clear after 5 seconds from the last notification
            vi.advanceTimersByTime(5000);
            expect(get(notification)).toBeNull();
        });

        it('should handle empty message', () => {
            setNotification('', 'info');

            expect(get(notification)).toEqual({
                message: '',
                type: 'info'
            });
        });

        it('should handle undefined type by defaulting to error', () => {
            setNotification('Test message', undefined);

            expect(get(notification)).toEqual({
                message: 'Test message',
                type: 'error'
            });
        });
    });

    describe('timer behavior', () => {
        it('should handle multiple overlapping timers correctly', () => {
            // Set first notification
            setNotification('First', 'info');

            // Fast-forward 2 seconds
            vi.advanceTimersByTime(2000);

            // Set second notification (creates new timer, doesn't cancel first)
            setNotification('Second', 'warning');

            // Fast-forward 3 seconds (total 5 from first timer)
            // First timer should fire and set notification to null
            vi.advanceTimersByTime(3000);
            expect(get(notification)).toBeNull();

            // Fast-forward 2 more seconds (total 5 from second timer)
            // Second timer should fire but notification is already null
            vi.advanceTimersByTime(2000);
            expect(get(notification)).toBeNull();
        });

        it('should clear notification even if store is manually set to null before timeout', () => {
            setNotification('Test message', 'info');

            // Manually clear notification
            notification.set(null);
            expect(get(notification)).toBeNull();

            // Timer should still run but have no effect
            vi.advanceTimersByTime(5000);
            expect(get(notification)).toBeNull();
        });
    });
});
