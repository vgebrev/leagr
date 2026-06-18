/* eslint-disable no-console */

/**
 * Quick manual test for team logo generation.
 * Run with:
 *   OPENAI_API_KEY=sk-... node test-logo-gen.js
 *
 * Outputs a PNG to /tmp/test-logo.png
 */

import { generateTeamLogo, pickBadgeShapes } from '$lib/server/openaiImageClient.js';
import fs from 'fs/promises';

const teamName = process.argv[2] || 'blue wolves';
const [shape] = pickBadgeShapes(1);

console.log(`Generating logo for: "${teamName}"`);
console.log(`Badge shape: ${shape}`);

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not set in environment');
    process.exit(1);
}

const model = process.env.OPENAI_MODEL;
console.log(`Model: ${model}`);
console.log('Calling OpenAI...');

try {
    const buffer = await generateTeamLogo(teamName, shape, apiKey, model);
    const outPath = '/tmp/test-logo.png';
    await fs.writeFile(outPath, buffer);
    console.log(`Done. Saved to ${outPath} (${buffer.length} bytes)`);
} catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
}
