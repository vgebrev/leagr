import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { createAvatarManager, AvatarError } from '$lib/server/avatarManager.js';
import { logger } from '$lib/server/logger.js';
import fs from 'fs/promises';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, params, locals }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    // No access control - anyone can upload an avatar for any player
    // Admin approval is required before the avatar is displayed

    const avatarManager = createAvatarManager().setLeague(leagueId);

    try {
        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('image');

        if (!file || !(file instanceof File)) {
            throw new AvatarError('No image file provided', 400);
        }

        // Validate and process image
        const { buffer } = await avatarManager.validateUpload(file);
        const processedBuffer = await avatarManager.processImage(buffer);

        // Delete old pending avatar if exists
        const { pendingAvatar: oldPendingAvatar } = await avatarManager.getPlayerAvatar(player);
        if (oldPendingAvatar) {
            await avatarManager.deleteFile(oldPendingAvatar);
        }

        // Save new avatar
        const filename = await avatarManager.saveFile(processedBuffer);

        // Update rankings metadata with pending avatar
        await avatarManager.updatePlayerAvatar(player, {
            pendingAvatar: filename
        });

        return json({
            success: true,
            pendingAvatar: filename,
            message: 'Avatar uploaded successfully and is pending approval'
        });
    } catch (err) {
        if (err instanceof AvatarError) {
            logger.error('Avatar upload error (AvatarError):', {
                player,
                statusCode: err.statusCode,
                message: err.message,
                stack: err.stack
            });
            throw error(err.statusCode, {
                message: err.message,
                exception: {
                    name: err.name,
                    message: err.message
                }
            });
        }
        logger.error('Avatar upload error (unexpected):', {
            player,
            message: err.message,
            name: err.name,
            stack: err.stack
        });
        throw error(500, {
            message: 'Failed to upload avatar',
            exception: {
                name: err.name,
                message: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            }
        });
    }
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals, url }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    const avatarManager = createAvatarManager().setLeague(leagueId);

    try {
        // Check if requesting pending avatar
        const showPending = url.searchParams.get('pending') === 'true';
        const { avatar, pendingAvatar } = await avatarManager.getPlayerAvatar(player);

        // Determine which avatar to serve
        const avatarToServe = showPending ? pendingAvatar : avatar;

        if (!avatarToServe) {
            throw error(404, 'Avatar not found');
        }

        const avatarPath = avatarManager.getAvatarFilePath(avatarToServe);

        try {
            const fileBuffer = await fs.readFile(avatarPath);

            // Use shorter cache for pending avatars to avoid stale cache issues
            const cacheControl = showPending
                ? 'public, max-age=60, must-revalidate' // 1 minute for pending
                : 'public, max-age=604800'; // 1 week for approved

            return new Response(fileBuffer, {
                headers: {
                    'Content-Type': 'image/webp',
                    'Cache-Control': cacheControl
                }
            });
        } catch {
            throw error(404, 'Avatar file not found');
        }
    } catch (err) {
        if (err.status) {
            throw err;
        }
        console.error('Avatar retrieval error:', err);
        throw error(500, 'Failed to retrieve avatar');
    }
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request, params, locals }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    // Admin only
    if (!locals.isAdmin) {
        throw error(403, 'Admin access required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    const avatarManager = createAvatarManager().setLeague(leagueId);

    try {
        const { status } = await request.json();

        if (!status || !['approved', 'rejected'].includes(status)) {
            throw error(400, 'Invalid status. Must be "approved" or "rejected"');
        }

        // Get current avatar info
        const { avatar: currentAvatar, pendingAvatar } =
            await avatarManager.getPlayerAvatar(player);

        if (!pendingAvatar) {
            throw error(404, 'No pending avatar found for this player');
        }

        // If rejected, delete the pending avatar file
        if (status === 'rejected') {
            await avatarManager.deleteFile(pendingAvatar);

            // Clear pendingAvatar metadata
            await avatarManager.updatePlayerAvatar(player, {
                pendingAvatar: null
            });

            return json({
                success: true,
                status: 'rejected',
                message: 'Avatar rejected and removed'
            });
        }

        // Approve: delete old avatar if exists, move pending to avatar
        if (currentAvatar) {
            await avatarManager.deleteFile(currentAvatar);
        }

        await avatarManager.updatePlayerAvatar(player, {
            avatar: pendingAvatar,
            pendingAvatar: null
        });

        return json({
            success: true,
            status: 'approved',
            message: 'Avatar approved'
        });
    } catch (err) {
        if (err.status) {
            throw err;
        }
        console.error('Avatar approval error:', err);
        throw error(500, 'Failed to update avatar status');
    }
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    // No access control - anyone can delete an avatar
    // This is used for users to remove their own avatars

    const avatarManager = createAvatarManager().setLeague(leagueId);

    try {
        await avatarManager.deletePlayerAvatar(player);

        return json({
            success: true,
            message: 'Avatar deleted successfully'
        });
    } catch (err) {
        console.error('Avatar deletion error:', err);
        throw error(500, 'Failed to delete avatar');
    }
}
