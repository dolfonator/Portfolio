// Rasterize the social share card (public/og-image.svg) to a PNG.
//
// Social platforms (Facebook, X, LinkedIn, iMessage, Slack, …) don't render
// SVG og:images, so we ship a PNG. This runs automatically before every build
// (via the `prebuild` npm hook) so the PNG can never drift from the SVG —
// edit og-image.svg, and the PNG regenerates on the next build.
//
// `sharp` is available because Astro depends on it for image optimization.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const src = join(publicDir, 'og-image.svg');
const out = join(publicDir, 'og-image.png');

try {
  const info = await sharp(src, { density: 200 })
    .resize(1200, 630)
    .png()
    .toFile(out);
  console.log(`[og-image] regenerated og-image.png (${info.width}x${info.height})`);
} catch (err) {
  console.error('[og-image] failed to regenerate PNG:', err.message);
  process.exit(1);
}
