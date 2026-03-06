import OpenAI from 'openai';
import { teamStyles } from '$lib/shared/helpers.js';
import { logger } from './logger.js';

/**
 * Available badge shapes. The caller picks N distinct shapes for N teams so
 * every team in a draw gets a different silhouette.
 * @type {string[]}
 */
export const BADGE_SHAPES = [
    'circular badge',
    'shield crest',
    'rounded shield',
    'hexagon badge',
    'diamond badge',
    'ellipse badge',
    'medallion emblem',
    'vintage ribbon crest',
    'angular esports shield',
    'modern geometric badge'
];

/**
 * Pick `count` distinct shapes at random from BADGE_SHAPES.
 * @param {number} count
 * @returns {string[]}
 */
export function pickBadgeShapes(count) {
    const shuffled = [...BADGE_SHAPES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Generate a team logo via gpt-image-1 and return the raw image buffer.
 *
 * @param {string} teamName - Full team name, e.g. "blue wolves"
 * @param {string} badgeShape - One of BADGE_SHAPES, e.g. "shield crest"
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Buffer>} PNG image buffer at 1024×1024
 */
export async function generateTeamLogo(teamName, badgeShape, apiKey) {
    if (!apiKey) {
        throw new Error('OpenAI API key is required');
    }

    const client = new OpenAI({ apiKey });

    const parts = teamName.trim().split(' ');
    const colour = parts[0].toLowerCase();
    const noun = parts.slice(1).join(' ');

    const style = teamStyles[colour];
    const logoPrompt = style?.logoPrompt;
    const primary = logoPrompt?.primary ?? colour;
    const secondaryOptions = logoPrompt?.secondary ?? ['white'];
    const secondary = secondaryOptions[Math.floor(Math.random() * secondaryOptions.length)];

    const prompt =
        `Minimalist flat vector sports team logo;` +
        `badge type: ${badgeShape} (outer boundary must clearly be a ${badgeShape});` +
        `team name: ${noun};` +
        `${primary} and ${secondary} colour scheme;` +
        `modern esports style.`;

    logger.info('[teamLogos] Calling OpenAI', { teamName, badgeShape, primary, secondary });

    const response = await client.images.generate({
        model: 'gpt-image-1.5',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'auto',
        background: 'transparent',
        output_format: 'webp'
    });

    const b64 = response.data[0].b64_json;
    if (!b64) throw new Error('No image data returned from OpenAI');

    const buffer = Buffer.from(b64, 'base64');
    logger.info('[teamLogos] Received image', { teamName, bytes: buffer.length });
    return buffer;
}
