import sharp from "sharp";
import { readFile } from "fs/promises";
import { join } from "path";

const ICONS_DIR = join(process.cwd(), "public", "icons");
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const APPLE_TOUCH_SIZE = 180;

async function svgToPng(svgPath: string, pngPath: string, size: number) {
  const svg = await readFile(svgPath);
  await sharp(svg)
    .resize(size, size, {
      fit: "contain",
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    })
    .png()
    .toFile(pngPath);
  console.log(`✓ ${pngPath} (${size}×${size})`);
}

async function main() {
  for (const size of SIZES) {
    const svgPath = join(ICONS_DIR, `icon-${size}x${size}.svg`);
    const pngPath = join(ICONS_DIR, `icon-${size}x${size}.png`);
    try {
      await svgToPng(svgPath, pngPath, size);
    } catch (err) {
      console.warn(`⚠ Atlandı: ${svgPath} (${(err as Error).message})`);
    }
  }

  // Maskable variant'lar — gerçek dosya adı: icon-maskable-{size}x{size}.svg
  for (const size of [192, 512]) {
    const svgPath = join(ICONS_DIR, `icon-maskable-${size}x${size}.svg`);
    const pngPath = join(ICONS_DIR, `icon-maskable-${size}x${size}.png`);
    try {
      await svgToPng(svgPath, pngPath, size);
    } catch (err) {
      console.warn(`⚠ Atlandı: ${svgPath} (${(err as Error).message})`);
    }
  }

  // Apple touch icon — 192 SVG'den 180×180 PNG
  const apple180Path = join("public", "apple-touch-icon.png");
  await svgToPng(
    join(ICONS_DIR, "icon-192x192.svg"),
    apple180Path,
    APPLE_TOUCH_SIZE
  );

  console.log("\n[OK] PNG ikon seti üretildi.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
