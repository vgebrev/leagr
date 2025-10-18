import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { getLeagueDataPath } from './league.js';
import { Mutex } from 'async-mutex';

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_SIZE = 512; // 512x512 pixels
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const OUTPUT_FORMAT = 'webp';

// Mutex for avatars.json operations
const avatarsMutexes = new Map();

/**
 * Custom error class for avatar operations
 */
export class AvatarError extends Error {
    /**
     * @param {string} message
     * @param {number} statusCode
     */
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'AvatarError';
        this.statusCode = statusCode;
    }
}

/**
 * Avatar management service
 */
export class AvatarManager {
    constructor() {
        this.leagueId = null;
    }

    /**
     * Set the league ID for this manager instance
     * @param {string} leagueId - League identifier
     * @returns {AvatarManager} - Fluent interface
     */
    setLeague(leagueId) {
        this.leagueId = leagueId;
        return this;
    }

    /**
     * Get the data path for the current league
     * @returns {string} - Data path
     */
    getDataPath() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing data path');
        }
        return getLeagueDataPath(this.leagueId);
    }

    /**
     * Get mutex for avatars file
     * @returns {Mutex} - League-specific mutex
     */
    getAvatarsMutex() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing mutex');
        }
        const key = `avatars-${this.leagueId}`;
        if (!avatarsMutexes.has(key)) {
            avatarsMutexes.set(key, new Mutex());
        }
        return avatarsMutexes.get(key);
    }

    /**
     * Get avatars metadata file path
     * @returns {string} - Avatars metadata file path
     */
    getAvatarsMetadataPath() {
        return path.join(this.getDataPath(), 'avatars.json');
    }

    /**
     * Get avatars directory path
     * @returns {string} - Avatars directory path
     */
    getAvatarsPath() {
        return path.join(this.getDataPath(), 'avatars');
    }

    /**
     * Load avatars metadata without mutex protection (internal use)
     * @returns {Promise<Object>} - Avatars metadata
     */
    async loadAvatarsUnsafe() {
        try {
            const data = await fs.readFile(this.getAvatarsMetadataPath(), 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return {};
            }
            throw err;
        }
    }

    /**
     * Load avatars metadata with mutex protection
     * @returns {Promise<Object>} - Avatars metadata
     */
    async loadAvatars() {
        const mutex = this.getAvatarsMutex();
        return await mutex.runExclusive(async () => {
            return await this.loadAvatarsUnsafe();
        });
    }

    /**
     * Save avatars metadata without mutex protection (internal use)
     * @param {Object} avatars - Avatars metadata to save
     * @returns {Promise<void>}
     */
    async saveAvatarsUnsafe(avatars) {
        await fs.writeFile(this.getAvatarsMetadataPath(), JSON.stringify(avatars, null, 2));
    }

    /**
     * Validate uploaded image file
     * @param {File} file - The uploaded file
     * @returns {Promise<{buffer: Buffer, metadata: Object}>}
     * @throws {AvatarError} If validation fails
     */
    async validateUpload(file) {
        if (!file) {
            throw new AvatarError('No file provided', 400);
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new AvatarError(
                `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                400
            );
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            throw new AvatarError(
                `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
                400
            );
        }

        try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const metadata = await sharp(buffer).metadata();

            if (!metadata.width || !metadata.height) {
                throw new AvatarError('Invalid image file', 400);
            }

            if (metadata.width > 4096 || metadata.height > 4096) {
                throw new AvatarError('Image dimensions too large (max 4096x4096)', 400);
            }

            return { buffer, metadata };
        } catch (err) {
            if (err instanceof AvatarError) {
                throw err;
            }
            throw new AvatarError('Failed to process image file', 400);
        }
    }

    /**
     * Process image: resize to square, center-crop, convert to WebP
     * @param {Buffer} buffer - Image buffer
     * @returns {Promise<Buffer>} Processed image buffer
     */
    async processImage(buffer) {
        try {
            return await sharp(buffer)
                .resize(AVATAR_SIZE, AVATAR_SIZE, {
                    fit: 'cover',
                    position: 'centre'
                })
                .webp({ quality: 85 })
                .toBuffer();
        } catch {
            throw new AvatarError('Failed to process image', 500);
        }
    }

    /**
     * Save avatar file to filesystem
     * @param {Buffer} buffer - Processed image buffer
     * @returns {Promise<string>} Filename (UUID.webp)
     */
    async saveFile(buffer) {
        const filename = `${randomUUID()}.${OUTPUT_FORMAT}`;
        const filePath = path.join(this.getAvatarsPath(), filename);

        try {
            await fs.mkdir(this.getAvatarsPath(), { recursive: true });
            await fs.writeFile(filePath, buffer);
            return filename;
        } catch {
            throw new AvatarError('Failed to save avatar file', 500);
        }
    }

    /**
     * Delete avatar file from filesystem
     * @param {string} filename
     */
    async deleteFile(filename) {
        if (!filename) return;

        const filePath = path.join(this.getAvatarsPath(), filename);

        try {
            await fs.unlink(filePath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error('Failed to delete avatar file:', err);
            }
        }
    }

    /**
     * Update player avatar metadata in avatars.json
     * @param {string} playerName
     * @param {Object} avatarData - { avatar?: filename, pendingAvatar?: filename }
     */
    async updatePlayerAvatar(playerName, avatarData) {
        const mutex = this.getAvatarsMutex();
        return await mutex.runExclusive(async () => {
            const avatars = await this.loadAvatarsUnsafe();

            if (!avatars[playerName]) {
                avatars[playerName] = {};
            }

            if (avatarData.avatar !== undefined) {
                if (avatarData.avatar === null) {
                    delete avatars[playerName].avatar;
                } else {
                    avatars[playerName].avatar = avatarData.avatar;
                }
            }
            if (avatarData.pendingAvatar !== undefined) {
                if (avatarData.pendingAvatar === null) {
                    delete avatars[playerName].pendingAvatar;
                } else {
                    avatars[playerName].pendingAvatar = avatarData.pendingAvatar;
                }
            }

            // Clean up empty player entries
            if (Object.keys(avatars[playerName]).length === 0) {
                delete avatars[playerName];
            }

            await this.saveAvatarsUnsafe(avatars);
        });
    }

    /**
     * Get player avatar info
     * @param {string} playerName
     * @returns {Promise<{avatar: string|null, pendingAvatar: string|null}>}
     */
    async getPlayerAvatar(playerName) {
        const avatars = await this.loadAvatars();
        const playerAvatar = avatars[playerName];

        if (!playerAvatar) {
            return { avatar: null, pendingAvatar: null };
        }

        return {
            avatar: playerAvatar.avatar || null,
            pendingAvatar: playerAvatar.pendingAvatar || null
        };
    }

    /**
     * Get all players with pending avatars
     * @returns {Promise<Array<{name: string, avatar: string}>>}
     */
    async getPendingAvatars() {
        const avatars = await this.loadAvatars();
        const pending = [];

        for (const [name, data] of Object.entries(avatars)) {
            if (data.pendingAvatar) {
                pending.push({ name, avatar: data.pendingAvatar });
            }
        }

        return pending;
    }

    /**
     * Delete player avatar (file and metadata)
     * @param {string} playerName
     */
    async deletePlayerAvatar(playerName) {
        const { avatar, pendingAvatar } = await this.getPlayerAvatar(playerName);

        if (avatar) {
            await this.deleteFile(avatar);
        }
        if (pendingAvatar) {
            await this.deleteFile(pendingAvatar);
        }

        await this.updatePlayerAvatar(playerName, {
            avatar: null,
            pendingAvatar: null
        });
    }

    /**
     * Get avatar file path
     * @param {string} filename
     * @returns {string}
     */
    getAvatarFilePath(filename) {
        return path.join(this.getAvatarsPath(), filename);
    }
}

/**
 * Create a new AvatarManager instance
 * @returns {AvatarManager}
 */
export function createAvatarManager() {
    return new AvatarManager();
}
