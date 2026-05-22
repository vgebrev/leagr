import sharp from 'sharp';

const DEFAULT_TOLERANCE = 40;

function colorDistance(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Replace the background colour (sampled from the four corners) with full transparency.
 * Uses BFS flood-fill so only contiguous background pixels are affected —
 * interior patches that happen to share the background hue are left intact.
 *
 * @param {Buffer} inputBuffer - Any Sharp-compatible image buffer
 * @param {number} [tolerance=40] - Max RGB Euclidean distance to treat as background
 * @returns {Promise<Buffer>} WebP buffer with background replaced by transparency
 */
export async function removeCornerBackground(inputBuffer, tolerance = DEFAULT_TOLERANCE) {
    const image = sharp(inputBuffer);
    const { width, height } = await image.metadata();

    const data = await image.ensureAlpha().raw().toBuffer();

    // Sample the four corners and average to get the background reference colour
    const corners = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1]
    ].map(([x, y]) => {
        const i = (y * width + x) * 4;
        return [data[i], data[i + 1], data[i + 2]];
    });

    const bgR = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
    const bgG = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
    const bgB = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);

    // BFS flood-fill from all four corners simultaneously
    // Encode each position as a single integer (y * width + x) for efficiency
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let qHead = 0;
    let qTail = 0;

    for (const [x, y] of [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1]
    ]) {
        const pos = y * width + x;
        if (!visited[pos]) {
            visited[pos] = 1;
            queue[qTail++] = pos;
        }
    }

    while (qHead < qTail) {
        const pos = queue[qHead++];
        const pixelIdx = pos * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];

        if (colorDistance(r, g, b, bgR, bgG, bgB) <= tolerance) {
            data[pixelIdx + 3] = 0;

            const x = pos % width;
            const y = Math.floor(pos / width);

            for (const [dx, dy] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1]
            ]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nPos = ny * width + nx;
                    if (!visited[nPos]) {
                        visited[nPos] = 1;
                        queue[qTail++] = nPos;
                    }
                }
            }
        }
    }

    return sharp(data, { raw: { width, height, channels: 4 } })
        .webp()
        .toBuffer();
}
