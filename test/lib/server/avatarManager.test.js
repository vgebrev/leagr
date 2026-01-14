import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, '../../test-data/avatar-test');
const TEST_LEAGUE_ID = 'test-league';

describe('AvatarManager - Pending Avatar Workflow', () => {
    let avatarManager;

    beforeEach(async () => {
        // Create test data directory
        await fs.mkdir(TEST_DATA_DIR, { recursive: true });

        // Mock getLeagueDataPath to return our test directory
        vi.mock('../../../src/lib/server/league.js', () => ({
            getLeagueDataPath: () => TEST_DATA_DIR
        }));

        // Re-import to get mocked version
        const { createAvatarManager: createMockedManager } =
            await import('../../../src/lib/server/avatarManager.js');
        avatarManager = createMockedManager().setLeague(TEST_LEAGUE_ID);

        // Create initial rankings.json
        await fs.writeFile(
            path.join(TEST_DATA_DIR, 'rankings.json'),
            JSON.stringify({
                players: {
                    TestPlayer: {
                        points: 100,
                        appearances: 5,
                        rankingDetail: {}
                    }
                },
                rankingMetadata: {}
            })
        );
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
        vi.restoreAllMocks();
    });

    describe('Upload with pendingAvatar', () => {
        it('should save new upload to pendingAvatar when no avatar exists', async () => {
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                pendingAvatar: 'new-avatar.webp'
            });

            const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar('TestPlayer');

            expect(avatar).toBeNull();
            expect(pendingAvatar).toBe('new-avatar.webp');
        });

        it('should save new upload to pendingAvatar when approved avatar exists', async () => {
            // Set up existing approved avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                avatar: 'approved-avatar.webp'
            });

            // Upload new avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                pendingAvatar: 'new-pending.webp'
            });

            const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar('TestPlayer');

            expect(avatar).toBe('approved-avatar.webp');
            expect(pendingAvatar).toBe('new-pending.webp');
        });

        it('should replace existing pendingAvatar with new upload', async () => {
            // Set up existing approved avatar and pending avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                avatar: 'approved.webp',
                pendingAvatar: 'old-pending.webp'
            });

            // Upload new pending avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                pendingAvatar: 'new-pending.webp'
            });

            const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar('TestPlayer');

            expect(avatar).toBe('approved.webp');
            expect(pendingAvatar).toBe('new-pending.webp');
        });
    });

    describe('Approval workflow', () => {
        it('should move pendingAvatar to avatar on approval', async () => {
            // Set up pending avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                pendingAvatar: 'pending.webp'
            });

            // Simulate approval: move pending to avatar, clear pending
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                avatar: 'pending.webp',
                pendingAvatar: null
            });

            const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar('TestPlayer');

            expect(avatar).toBe('pending.webp');
            expect(pendingAvatar).toBeNull();
        });

        it('should replace old avatar with approved pendingAvatar', async () => {
            // Set up existing approved avatar and pending avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                avatar: 'old-approved.webp',
                pendingAvatar: 'new-pending.webp'
            });

            // Approve: move pending to avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                avatar: 'new-pending.webp',
                pendingAvatar: null
            });

            const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar('TestPlayer');

            expect(avatar).toBe('new-pending.webp');
            expect(pendingAvatar).toBeNull();
        });
    });

    describe('Rejection workflow', () => {
        it('should remove pendingAvatar on rejection without affecting avatar', async () => {
            // Set up approved avatar and pending avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                avatar: 'approved.webp',
                pendingAvatar: 'rejected.webp'
            });

            // Reject: clear pending only
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                pendingAvatar: null
            });

            const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar('TestPlayer');

            expect(avatar).toBe('approved.webp');
            expect(pendingAvatar).toBeNull();
        });

        it('should handle rejection when no approved avatar exists', async () => {
            // Set up only pending avatar
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                pendingAvatar: 'rejected.webp'
            });

            // Reject: clear pending
            await avatarManager.updatePlayerAvatar('TestPlayer', {
                pendingAvatar: null
            });

            const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar('TestPlayer');

            expect(avatar).toBeNull();
            expect(pendingAvatar).toBeNull();
        });
    });

    describe('getPendingAvatars', () => {
        it('should return all players with pendingAvatar', async () => {
            await avatarManager.updatePlayerAvatar('Player1', {
                avatar: 'approved1.webp',
                pendingAvatar: 'pending1.webp'
            });

            await avatarManager.updatePlayerAvatar('Player2', {
                pendingAvatar: 'pending2.webp'
            });

            await avatarManager.updatePlayerAvatar('Player3', {
                avatar: 'approved3.webp'
            });

            const pending = await avatarManager.getPendingAvatars();

            expect(pending).toHaveLength(2);
            expect(pending).toEqual(
                expect.arrayContaining([
                    { name: 'Player1', avatar: 'pending1.webp' },
                    { name: 'Player2', avatar: 'pending2.webp' }
                ])
            );
        });

        it('should return empty array when no pending avatars', async () => {
            await avatarManager.updatePlayerAvatar('Player1', {
                avatar: 'approved.webp'
            });

            const pending = await avatarManager.getPendingAvatars();

            expect(pending).toEqual([]);
        });
    });

    describe('Concurrent operations', () => {
        it('should handle concurrent approvals safely', async () => {
            // Set up multiple pending avatars
            await avatarManager.updatePlayerAvatar('Player1', {
                pendingAvatar: 'pending1.webp'
            });
            await avatarManager.updatePlayerAvatar('Player2', {
                pendingAvatar: 'pending2.webp'
            });

            // Approve both concurrently
            await Promise.all([
                avatarManager.updatePlayerAvatar('Player1', {
                    avatar: 'pending1.webp',
                    pendingAvatar: null
                }),
                avatarManager.updatePlayerAvatar('Player2', {
                    avatar: 'pending2.webp',
                    pendingAvatar: null
                })
            ]);

            const player1 = await avatarManager.getPlayerAvatar('Player1');
            const player2 = await avatarManager.getPlayerAvatar('Player2');

            expect(player1.avatar).toBe('pending1.webp');
            expect(player1.pendingAvatar).toBeNull();
            expect(player2.avatar).toBe('pending2.webp');
            expect(player2.pendingAvatar).toBeNull();
        });
    });
});
