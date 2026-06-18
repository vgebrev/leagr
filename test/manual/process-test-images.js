/* eslint-disable no-console */
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { removeCornerBackground } from '../../src/lib/server/imageProcessor.js';

const images = [
    'OpenAI Playground 2026-05-18 at 15.08.49.webp',
    'OpenAI Playground 2026-05-18 at 16.52.39.webp',
    'OpenAI Playground 2026-05-18 at 18.08.31.webp'
];

for (const [i, name] of images.entries()) {
    const input = await readFile(join('test/test-data', name));
    const output = await removeCornerBackground(input);
    const outPath = `/tmp/processed-logo-${i + 1}.webp`;
    await writeFile(outPath, output);
    console.log(`Saved: ${outPath}  (${output.length} bytes)`);
}
