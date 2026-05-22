import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { removeCornerBackground } from '$lib/server/imageProcessor.js';

const TEST_DATA_DIR = join(process.cwd(), 'test/test-data');

const TEST_IMAGES = [
    'OpenAI Playground 2026-05-18 at 15.08.49.webp',
    'OpenAI Playground 2026-05-18 at 16.52.39.webp',
    'OpenAI Playground 2026-05-18 at 18.08.31.webp'
];

async function getRawPixels(buffer) {
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    const data = await image.ensureAlpha().raw().toBuffer();
    return { data, width, height };
}

function getAlpha(data, width, x, y) {
    return data[(y * width + x) * 4 + 3];
}

describe('removeCornerBackground', () => {
    for (const filename of TEST_IMAGES) {
        describe(filename, () => {
            it('makes all four corners fully transparent', async () => {
                const input = await readFile(join(TEST_DATA_DIR, filename));
                const output = await removeCornerBackground(input);
                const { data, width, height } = await getRawPixels(output);

                expect(getAlpha(data, width, 0, 0)).toBe(0);
                expect(getAlpha(data, width, width - 1, 0)).toBe(0);
                expect(getAlpha(data, width, 0, height - 1)).toBe(0);
                expect(getAlpha(data, width, width - 1, height - 1)).toBe(0);
            });

            it('preserves opaque pixels in the badge interior', async () => {
                const input = await readFile(join(TEST_DATA_DIR, filename));
                const output = await removeCornerBackground(input);
                const { data, width, height } = await getRawPixels(output);

                let opaqueCount = 0;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] === 255) opaqueCount++;
                }

                // Badge should occupy a meaningful portion of the image
                const totalPixels = width * height;
                expect(opaqueCount).toBeGreaterThan(totalPixels * 0.05);
            });

            it('removes the majority of background pixels', async () => {
                const input = await readFile(join(TEST_DATA_DIR, filename));
                const output = await removeCornerBackground(input);
                const { data, width, height } = await getRawPixels(output);

                let transparentCount = 0;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] === 0) transparentCount++;
                }

                const totalPixels = width * height;
                expect(transparentCount).toBeGreaterThan(totalPixels * 0.2);
            });

            it('returns a valid webp buffer', async () => {
                const input = await readFile(join(TEST_DATA_DIR, filename));
                const output = await removeCornerBackground(input);
                const { format } = await sharp(output).metadata();
                expect(format).toBe('webp');
            });
        });
    }

    it('accepts a custom tolerance', async () => {
        const input = await readFile(join(TEST_DATA_DIR, TEST_IMAGES[0]));
        // High tolerance should remove at least as much background as default
        const outputDefault = await removeCornerBackground(input);
        const outputHigh = await removeCornerBackground(input, 80);

        const countTransparent = async (buf) => {
            const { data } = await getRawPixels(buf);
            let count = 0;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] === 0) count++;
            }
            return count;
        };

        const defaultTransparent = await countTransparent(outputDefault);
        const highTransparent = await countTransparent(outputHigh);
        expect(highTransparent).toBeGreaterThanOrEqual(defaultTransparent);
    });
});
