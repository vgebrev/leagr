import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock DOM APIs
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};

const mockDocument = {
    documentElement: {
        classList: {
            add: vi.fn(),
            remove: vi.fn()
        }
    }
};

const mockWindow = {
    matchMedia: vi.fn(() => ({
        matches: false
    }))
};

// Mock browser APIs globally
vi.stubGlobal('localStorage', mockLocalStorage);
vi.stubGlobal('document', mockDocument);
vi.stubGlobal('window', mockWindow);

describe('Theme Store', () => {
    let theme;

    beforeEach(async () => {
        // Clear module cache to get fresh instances
        vi.resetModules();
        
        // Reset mocks
        vi.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue(null);
        mockWindow.matchMedia.mockReturnValue({ matches: false });
        
        const themeModule = await import('$lib/client/stores/theme.js');
        theme = themeModule.theme;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize with system theme when no localStorage value', async () => {
            mockLocalStorage.getItem.mockReturnValue(null);
            
            // Re-import to trigger initialization
            vi.resetModules();
            const themeModule = await import('$lib/client/stores/theme.js');
            const freshTheme = themeModule.theme;
            
            expect(get(freshTheme)).toBe('system');
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('theme');
        });

        it('should initialize with saved theme from localStorage', async () => {
            mockLocalStorage.getItem.mockReturnValue('dark');
            
            // Re-import to trigger initialization
            vi.resetModules();
            const themeModule = await import('$lib/client/stores/theme.js');
            const freshTheme = themeModule.theme;
            
            expect(get(freshTheme)).toBe('dark');
        });

        it('should initialize with system theme when localStorage has invalid value', async () => {
            mockLocalStorage.getItem.mockReturnValue('invalid');
            
            // Re-import to trigger initialization
            vi.resetModules();
            const themeModule = await import('$lib/client/stores/theme.js');
            const freshTheme = themeModule.theme;
            
            expect(get(freshTheme)).toBe('system');
        });

        it('should handle localStorage being undefined', async () => {
            // Temporarily unstub localStorage
            vi.unstubAllGlobals();
            
            // Re-import to trigger initialization
            vi.resetModules();
            const themeModule = await import('$lib/client/stores/theme.js');
            const freshTheme = themeModule.theme;
            
            expect(get(freshTheme)).toBe('system');
            
            // Restore mocks
            vi.stubGlobal('localStorage', mockLocalStorage);
            vi.stubGlobal('document', mockDocument);
            vi.stubGlobal('window', mockWindow);
        });
    });

    describe('theme store', () => {
        it('should update when set manually', () => {
            theme.set('dark');
            expect(get(theme)).toBe('dark');
        });

        it('should allow subscription to changes', () => {
            const subscriber = vi.fn();
            const unsubscribe = theme.subscribe(subscriber);
            
            // Should be called immediately with current value
            expect(subscriber).toHaveBeenCalledWith('system');
            
            theme.set('light');
            expect(subscriber).toHaveBeenCalledWith('light');
            expect(subscriber).toHaveBeenCalledTimes(2);
            
            unsubscribe();
        });
    });

    describe('theme subscription side effects', () => {
        beforeEach(() => {
            // Reset document mock
            mockDocument.documentElement.classList.add.mockClear();
            mockDocument.documentElement.classList.remove.mockClear();
        });

        it('should update localStorage when theme changes', () => {
            theme.set('dark');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
            
            theme.set('light');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');
        });

        it('should add dark class when theme is dark', () => {
            theme.set('dark');
            expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('dark');
            expect(mockDocument.documentElement.classList.remove).not.toHaveBeenCalled();
        });

        it('should remove dark class when theme is light', () => {
            theme.set('light');
            expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('dark');
            expect(mockDocument.documentElement.classList.add).not.toHaveBeenCalled();
        });

        it('should handle system theme with dark preference', () => {
            // Setup for dark system preference
            mockWindow.matchMedia.mockReturnValue({ matches: true });
            
            // Set to light first to ensure we can observe the change
            theme.set('light');
            mockDocument.documentElement.classList.add.mockClear();
            mockDocument.documentElement.classList.remove.mockClear();
            
            theme.set('system');
            expect(mockWindow.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
            expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('dark');
        });

        it('should handle system theme with light preference', () => {
            // Setup for light system preference
            mockWindow.matchMedia.mockReturnValue({ matches: false });
            
            // Set to dark first to ensure we can observe the change
            theme.set('dark');
            mockDocument.documentElement.classList.add.mockClear();
            mockDocument.documentElement.classList.remove.mockClear();
            
            theme.set('system');
            expect(mockWindow.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
            expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('dark');
        });

        it('should handle document being undefined (SSR)', () => {
            // Temporarily unstub document
            vi.unstubAllGlobals();
            vi.stubGlobal('localStorage', mockLocalStorage);
            vi.stubGlobal('window', mockWindow);
            
            // Should not throw when document is undefined
            expect(() => {
                theme.set('dark');
            }).not.toThrow();
            
            // Restore document mock
            vi.stubGlobal('document', mockDocument);
        });

        it('should handle multiple theme changes', () => {
            theme.set('dark');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
            expect(mockDocument.documentElement.classList.add).toHaveBeenCalledWith('dark');
            
            theme.set('light');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');
            expect(mockDocument.documentElement.classList.remove).toHaveBeenCalledWith('dark');
            
            theme.set('system');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'system');
            expect(mockWindow.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
        });
    });

    describe('valid theme values', () => {
        const validThemes = ['light', 'dark', 'system'];
        
        validThemes.forEach(themeValue => {
            it(`should handle ${themeValue} theme correctly`, () => {
                theme.set(themeValue);
                expect(get(theme)).toBe(themeValue);
                expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', themeValue);
            });
        });
    });
});