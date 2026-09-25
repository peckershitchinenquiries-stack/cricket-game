// Renders PWA icons and the static OG image from SVG sources.
// Usage: npm run generate:icons
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(join(pub, 'icons'), { recursive: true });

const icon = readFileSync(join(pub, 'icon.svg'));

await sharp(icon, { density: 384 }).resize(192, 192).png().toFile(join(pub, 'icons/icon-192.png'));
await sharp(icon, { density: 384 }).resize(512, 512).png().toFile(join(pub, 'icons/icon-512.png'));
await sharp(icon, { density: 384 }).resize(180, 180).png().toFile(join(pub, 'icons/apple-touch-icon.png'));

// Maskable: icon art inside the 80% safe zone on a full-bleed background.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="#0a1a2e"/>
  <image href="data:image/svg+xml;base64,${icon.toString('base64')}" x="56" y="56" width="400" height="400"/>
</svg>`;
await sharp(Buffer.from(maskable), { density: 144 }).png().toFile(join(pub, 'icons/icon-maskable-512.png'));

// Static Open Graph fallback (the dynamic one lives in app/opengraph-image.tsx).
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="g" cx="50%" cy="0%" r="90%">
      <stop offset="0" stop-color="#0f3a2a"/><stop offset="0.6" stop-color="#0a1a2e"/><stop offset="1" stop-color="#050e1a"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <image href="data:image/svg+xml;base64,${icon.toString('base64')}" x="120" y="175" width="280" height="280"/>
  <text x="450" y="290" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="96" font-weight="800" fill="#ffffff">CrickeTap</text>
  <text x="454" y="360" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="36" fill="#b0bec5">The daily cricket geography quiz</text>
  <g transform="translate(456 410)">
    <circle cx="18" cy="18" r="18" fill="#4caf50"/><circle cx="68" cy="18" r="18" fill="#ffeb3b"/>
    <circle cx="118" cy="18" r="18" fill="#ff9800"/><circle cx="168" cy="18" r="18" fill="#4caf50"/>
    <circle cx="218" cy="18" r="18" fill="#f44336"/>
  </g>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(join(pub, 'og-image.png'));

console.log('Icons and OG image generated in /public');
