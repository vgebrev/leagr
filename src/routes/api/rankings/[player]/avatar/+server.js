import { json, error } from '@sveltejs/kit';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { PlayerAccessControl } from '$lib/server/playerAccessControl.js';
import { createAvatarManager, AvatarError } from '$lib/server/avatarManager.js';
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

    // Check ownership (admin can bypass)
    const clientId = request.headers.get('x-client-id');
    const accessControl = new PlayerAccessControl(locals.isAdmin);

    try {
        await accessControl.validatePlayerAccess(player, clientId, leagueId);
    } catch (err) {
        throw error(403, err.message || 'Access denied');
    }

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

        // Delete old avatar if exists
        const { avatar: oldAvatar } = await avatarManager.getPlayerAvatar(player);
        if (oldAvatar) {
            await avatarManager.deleteFile(oldAvatar);
        }

        // Save new avatar
        const filename = await avatarManager.saveFile(processedBuffer);

        // Update rankings metadata with pending status
        await avatarManager.updatePlayerAvatar(player, {
            avatar: filename,
            avatarStatus: 'pending'
        });

        return json({
            success: true,
            avatar: filename,
            avatarStatus: 'pending',
            message: 'Avatar uploaded successfully and is pending approval'
        });
    } catch (err) {
        if (err instanceof AvatarError) {
            throw error(err.statusCode, err.message);
        }
        console.error('Avatar upload error:', err);
        throw error(500, 'Failed to upload avatar');
    }
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
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
        const { avatar, avatarStatus } = await avatarManager.getPlayerAvatar(player);

        // Only serve approved avatars (admins can see all)
        if (!avatar || (avatarStatus !== 'approved' && !locals.isAdmin)) {
            throw error(404, 'Avatar not found');
        }

        const avatarPath = avatarManager.getAvatarFilePath(avatar);

        try {
            const fileBuffer = await fs.readFile(avatarPath);

            return new Response(fileBuffer, {
                headers: {
                    'Content-Type': 'image/webp',
                    'Cache-Control': 'public, max-age=604800' // Cache for 1 week
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
        const { avatar } = await avatarManager.getPlayerAvatar(player);

        if (!avatar) {
            throw error(404, 'No avatar found for this player');
        }

        // If rejected, delete the file
        if (status === 'rejected') {
            await avatarManager.deleteFile(avatar);

            // Update metadata
            await avatarManager.updatePlayerAvatar(player, {
                avatar: null,
                avatarStatus: 'rejected'
            });

            return json({
                success: true,
                status: 'rejected',
                message: 'Avatar rejected and removed'
            });
        }

        // Approve avatar
        await avatarManager.updatePlayerAvatar(player, {
            avatarStatus: 'approved'
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
export async function DELETE({ request, params, locals }) {
    const { player } = params;

    if (!player) {
        throw error(400, 'Player name is required');
    }

    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        throw error(404, 'League not found');
    }

    // Check ownership (admin can bypass)
    const clientId = request.headers.get('x-client-id');
    const accessControl = new PlayerAccessControl(locals.isAdmin);

    try {
        await accessControl.validatePlayerAccess(player, clientId, leagueId);
    } catch (err) {
        throw error(403, err.message || 'Access denied');
    }

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
