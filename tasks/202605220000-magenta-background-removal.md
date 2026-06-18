# Magenta Background Removal for AI-Generated Team Logos

## Overview

OpenAI's `gpt-image-1` family models were prompted to fill the area outside the badge with a specific magenta colour instead of transparency (which caused inconsistent interior holes). A post-generation processing step now strips that magenta background and replaces it with true transparency.

## Approach

Corner-sampling flood-fill:

1. Sample the RGB value at all four corners of the generated image and average them to get a background colour reference.
2. BFS flood-fill from all four corners simultaneously, marking any pixel within a configurable Euclidean RGB distance (default: 40) as fully transparent.
3. Because the fill is contiguous from the edges, interior patches that happen to share the magenta hue are left intact.

## Architecture Decisions

- **Separate helper module** (`imageProcessor.js`) keeps the processing logic isolated and independently testable from the logo manager.
- **Raw archival** (`logos/openai-output/`) stores the unmodified OpenAI output alongside the processed logo in `logos/`. This preserves the original for debugging or reprocessing with adjusted tolerances without needing to call the API again.
- **No mutex on raw save** — `saveRawLogo` only writes a file with no metadata JSON update, so concurrent writes to different team logos are safe.
- **Tolerance of 40** — covers the natural variation in the model's magenta output without bleeding into badge colours. Exposed as a parameter for future tuning.

## Files Modified

| File                                     | Change                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/server/imageProcessor.js`       | New — `removeCornerBackground(buffer, tolerance?)`                                                     |
| `src/lib/server/teamLogoManager.js`      | Added `getOpenAIOutputDir()`, `saveRawLogo()`, updated `generateLogosForDraw` to save raw then process |
| `test/lib/server/imageProcessor.test.js` | New — 13 tests across all 3 test images                                                                |

## Testing

Tests in `test/lib/server/imageProcessor.test.js` run against real webp images from `test/test-data/`. Assertions verify:

- All four corners become fully transparent after processing
- A meaningful portion of pixels remain opaque (badge preserved, > 5% of total)
- A significant portion of pixels become transparent (background removed, > 20% of total)
- Output format is valid webp
- Higher tolerance removes at least as many pixels as the default
