import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { globalSettingsCache, invalidateSettingsCache } from '$lib/server/settingsCache.js';

describe('Settings Cache', () => {
    beforeEach(() => {
        // Clear cache before each test
        globalSettingsCache.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('basic cache operations', () => {
        it('should store and retrieve settings', () => {
            const testSettings = { playerLimit: 20, teamsCount: 2 };
            
            globalSettingsCache.set('league1', '2024-01-15', testSettings);
            const retrieved = globalSettingsCache.get('league1', '2024-01-15');
            
            expect(retrieved).toEqual(testSettings);
        });

        it('should return null for cache miss', () => {
            const result = globalSettingsCache.get('nonexistent', '2024-01-15');
            expect(result).toBeNull();
        });

        it('should provide league isolation', () => {
            const league1Settings = { playerLimit: 20 };
            const league2Settings = { playerLimit: 30 };
            
            globalSettingsCache.set('league1', '2024-01-15', league1Settings);
            globalSettingsCache.set('league2', '2024-01-15', league2Settings);
            
            expect(globalSettingsCache.get('league1', '2024-01-15')).toEqual(league1Settings);
            expect(globalSettingsCache.get('league2', '2024-01-15')).toEqual(league2Settings);
        });

        it('should provide date isolation within same league', () => {
            const date1Settings = { playerLimit: 20 };
            const date2Settings = { playerLimit: 25 };
            
            globalSettingsCache.set('league1', '2024-01-15', date1Settings);
            globalSettingsCache.set('league1', '2024-01-16', date2Settings);
            
            expect(globalSettingsCache.get('league1', '2024-01-15')).toEqual(date1Settings);
            expect(globalSettingsCache.get('league1', '2024-01-16')).toEqual(date2Settings);
        });

        it('should return deep clones to prevent mutation', () => {
            const originalSettings = { playerLimit: 20, nested: { value: 'test' } };
            
            globalSettingsCache.set('league1', '2024-01-15', originalSettings);
            const retrieved1 = globalSettingsCache.get('league1', '2024-01-15');
            const retrieved2 = globalSettingsCache.get('league1', '2024-01-15');
            
            // Modify first retrieved object
            retrieved1.playerLimit = 999;
            retrieved1.nested.value = 'modified';
            
            // Second retrieval should be unaffected
            expect(retrieved2.playerLimit).toBe(20);
            expect(retrieved2.nested.value).toBe('test');
            
            // Original should also be unaffected (stored as clone)
            expect(originalSettings.playerLimit).toBe(20);
            expect(originalSettings.nested.value).toBe('test');
        });
    });

    describe('TTL expiration', () => {
        it('should expire entries after TTL', () => {
            const testSettings = { playerLimit: 20 };
            
            // Mock Date.now to control time
            const mockNow = vi.spyOn(Date, 'now');
            mockNow.mockReturnValue(1000);
            
            globalSettingsCache.set('league1', '2024-01-15', testSettings);
            
            // Should be available immediately
            expect(globalSettingsCache.get('league1', '2024-01-15')).toEqual(testSettings);
            
            // Advance time beyond TTL (5 minutes = 300,000ms)
            mockNow.mockReturnValue(1000 + 300001);
            
            // Should now return null (expired)
            expect(globalSettingsCache.get('league1', '2024-01-15')).toBeNull();
        });

        it('should not expire entries before TTL', () => {
            const testSettings = { playerLimit: 20 };
            
            const mockNow = vi.spyOn(Date, 'now');
            mockNow.mockReturnValue(1000);
            
            globalSettingsCache.set('league1', '2024-01-15', testSettings);
            
            // Advance time but not beyond TTL
            mockNow.mockReturnValue(1000 + 299999); // Just under 5 minutes
            
            // Should still be available
            expect(globalSettingsCache.get('league1', '2024-01-15')).toEqual(testSettings);
        });
    });

    describe('cache invalidation', () => {
        it('should invalidate specific league-date combination', () => {
            const settings1 = { playerLimit: 20 };
            const settings2 = { playerLimit: 25 };
            
            globalSettingsCache.set('league1', '2024-01-15', settings1);
            globalSettingsCache.set('league1', '2024-01-16', settings2);
            
            globalSettingsCache.invalidate('league1', '2024-01-15');
            
            expect(globalSettingsCache.get('league1', '2024-01-15')).toBeNull();
            expect(globalSettingsCache.get('league1', '2024-01-16')).toEqual(settings2);
        });

        it('should invalidate entire league', () => {
            const settings1 = { playerLimit: 20 };
            const settings2 = { playerLimit: 25 };
            const otherLeagueSettings = { playerLimit: 30 };
            
            globalSettingsCache.set('league1', '2024-01-15', settings1);
            globalSettingsCache.set('league1', '2024-01-16', settings2);
            globalSettingsCache.set('league2', '2024-01-15', otherLeagueSettings);
            
            globalSettingsCache.invalidateLeague('league1');
            
            expect(globalSettingsCache.get('league1', '2024-01-15')).toBeNull();
            expect(globalSettingsCache.get('league1', '2024-01-16')).toBeNull();
            expect(globalSettingsCache.get('league2', '2024-01-15')).toEqual(otherLeagueSettings);
        });

        it('should use convenience invalidation function', () => {
            const settings = { playerLimit: 20 };
            
            globalSettingsCache.set('league1', '2024-01-15', settings);
            globalSettingsCache.set('league1', '2024-01-16', settings);
            
            // Test single date invalidation
            invalidateSettingsCache('league1', '2024-01-15');
            expect(globalSettingsCache.get('league1', '2024-01-15')).toBeNull();
            expect(globalSettingsCache.get('league1', '2024-01-16')).toEqual(settings);
            
            // Re-add and test league invalidation
            globalSettingsCache.set('league1', '2024-01-15', settings);
            invalidateSettingsCache('league1'); // No date = entire league
            
            expect(globalSettingsCache.get('league1', '2024-01-15')).toBeNull();
            expect(globalSettingsCache.get('league1', '2024-01-16')).toBeNull();
        });
    });

    describe('cache statistics and maintenance', () => {
        it('should provide accurate cache statistics', () => {
            const mockNow = vi.spyOn(Date, 'now');
            mockNow.mockReturnValue(1000);
            
            // Add some entries
            globalSettingsCache.set('league1', '2024-01-15', { playerLimit: 20 });
            globalSettingsCache.set('league1', '2024-01-16', { playerLimit: 25 });
            globalSettingsCache.set('league2', '2024-01-15', { playerLimit: 30 });
            
            let stats = globalSettingsCache.getStats();
            expect(stats.totalEntries).toBe(3);
            expect(stats.activeEntries).toBe(3);
            expect(stats.expiredEntries).toBe(0);
            
            // Advance time to expire some entries
            mockNow.mockReturnValue(1000 + 300001);
            
            stats = globalSettingsCache.getStats();
            expect(stats.totalEntries).toBe(3);
            expect(stats.activeEntries).toBe(0);
            expect(stats.expiredEntries).toBe(3);
        });

        it('should clean up expired entries', () => {
            const mockNow = vi.spyOn(Date, 'now');
            mockNow.mockReturnValue(1000);
            
            globalSettingsCache.set('league1', '2024-01-15', { playerLimit: 20 });
            globalSettingsCache.set('league1', '2024-01-16', { playerLimit: 25 });
            
            // Advance time to expire entries
            mockNow.mockReturnValue(1000 + 300001);
            
            const cleanedCount = globalSettingsCache.cleanup();
            expect(cleanedCount).toBe(2);
            
            const stats = globalSettingsCache.getStats();
            expect(stats.totalEntries).toBe(0);
        });

        it('should clear entire cache', () => {
            globalSettingsCache.set('league1', '2024-01-15', { playerLimit: 20 });
            globalSettingsCache.set('league2', '2024-01-16', { playerLimit: 25 });
            
            expect(globalSettingsCache.getStats().totalEntries).toBe(2);
            
            globalSettingsCache.clear();
            
            expect(globalSettingsCache.getStats().totalEntries).toBe(0);
            expect(globalSettingsCache.get('league1', '2024-01-15')).toBeNull();
            expect(globalSettingsCache.get('league2', '2024-01-16')).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('should handle empty settings objects', () => {
            const emptySettings = {};
            
            globalSettingsCache.set('league1', '2024-01-15', emptySettings);
            const retrieved = globalSettingsCache.get('league1', '2024-01-15');
            
            expect(retrieved).toEqual({});
        });

        it('should handle complex nested settings', () => {
            const complexSettings = {
                playerLimit: 20,
                teams: {
                    count: 4,
                    config: {
                        maxPlayers: 5,
                        positions: ['GK', 'DEF', 'MID', 'FWD']
                    }
                },
                schedule: {
                    startTime: '18:00',
                    duration: 90,
                    breaks: [{ start: 45, duration: 15 }]
                }
            };
            
            globalSettingsCache.set('league1', '2024-01-15', complexSettings);
            const retrieved = globalSettingsCache.get('league1', '2024-01-15');
            
            expect(retrieved).toEqual(complexSettings);
            
            // Test deep clone by modifying nested properties
            retrieved.teams.count = 999;
            retrieved.teams.config.positions.push('NEW');
            
            const retrievedAgain = globalSettingsCache.get('league1', '2024-01-15');
            expect(retrievedAgain.teams.count).toBe(4);
            expect(retrievedAgain.teams.config.positions).toHaveLength(4);
        });

        it('should handle rapid invalidation and re-caching', () => {
            const settings = { playerLimit: 20 };
            
            globalSettingsCache.set('league1', '2024-01-15', settings);
            expect(globalSettingsCache.get('league1', '2024-01-15')).toEqual(settings);
            
            globalSettingsCache.invalidate('league1', '2024-01-15');
            expect(globalSettingsCache.get('league1', '2024-01-15')).toBeNull();
            
            const newSettings = { playerLimit: 25 };
            globalSettingsCache.set('league1', '2024-01-15', newSettings);
            expect(globalSettingsCache.get('league1', '2024-01-15')).toEqual(newSettings);
        });
    });
});