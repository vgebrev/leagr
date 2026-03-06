import { error } from '@sveltejs/kit';
import sharp from 'sharp';
import fs from 'fs/promises';
import { createTeamLogoManager } from '$lib/server/teamLogoManager.js';
import { validateLeagueForAPI } from '$lib/server/league.js';
import { validateDateParameter } from '$lib/shared/validation.js';
import { teamColours } from '$lib/shared/helpers.js';

const MAX_SIZE = 1024;
const MIN_SIZE = 16;

/**
 * GET /api/teams/logos/[teamName]?date=YYYY-MM-DD&size=256
 * Serves the generated logo for a team on a given date.
 * Falls back to the static colour logo (/logos/{colour}.webp) if none generated yet.
 * Optional `size` query param resizes the image (16–1024, preserving aspect ratio).
 */
export const GET = async ({ params, url, locals }) => {
    const { leagueId, isValid } = validateLeagueForAPI(locals);
    if (!isValid) {
        return error(404, 'League not found');
    }

    const dateValidation = validateDateParameter(url.searchParams);
    if (!dateValidation.isValid) {
        return error(400, dateValidation.error);
    }

    const teamName = decodeURIComponent(params.teamName);
    if (!teamName) {
        return error(400, 'Team name is required');
    }

    // Derive colour from first word of team name for fallback
    const colour = teamName.split(' ')[0].toLowerCase();
    const fallbackUrl = `/logos/${teamColours.includes(colour) ? colour : 'blue'}.webp`;

    const logoManager = createTeamLogoManager().setLeague(leagueId);
    const filename = await logoManager.getLogo(dateValidation.date, teamName);

    if (!filename) {
        return new Response(null, {
            status: 302,
            headers: { Location: fallbackUrl, 'Cache-Control': 'no-store' }
        });
    }

    const filePath = logoManager.getLogoFilePath(filename);

    try {
        let imageBuffer = await fs.readFile(filePath);

        const sizeParam = url.searchParams.get('size');
        if (sizeParam !== null) {
            const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, parseInt(sizeParam, 10) || MAX_SIZE));
            if (size !== MAX_SIZE) {
                imageBuffer = await sharp(imageBuffer)
                    .resize(size, size, { fit: 'inside' })
                    .webp()
                    .toBuffer();
            }
        }

        return new Response(imageBuffer, {
            headers: {
                'Content-Type': 'image/webp',
                'Cache-Control': 'public, max-age=2592000' // 30 days
            }
        });
    } catch {
        return new Response(null, {
            status: 302,
            headers: { Location: fallbackUrl, 'Cache-Control': 'no-store' }
        });
    }
};
