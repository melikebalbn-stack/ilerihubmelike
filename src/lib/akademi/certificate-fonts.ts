import fs from "fs/promises";
import path from "path";

const FONT_BASE = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "inter",
  "files"
);

let cachedRegular: Buffer | null = null;
let cachedBold: Buffer | null = null;
let cachedItalic: Buffer | null = null;

/**
 * Inter font dosyalarını disk'ten yükler ve cache'ler.
 * Latin Extended (Türkçe karakterler dahil).
 *
 * @fontsource/inter sadece woff/woff2 sağlıyor — pdf-lib + fontkit
 * woff'u destekler. (woff2 brotli decompression sıkıntısı yapabilir;
 * bu sebeple woff tercih edildi.)
 */
export async function loadInterFonts() {
  if (!cachedRegular || !cachedBold || !cachedItalic) {
    const [reg, bold, italic] = await Promise.all([
      fs.readFile(path.join(FONT_BASE, "inter-latin-ext-400-normal.woff")),
      fs.readFile(path.join(FONT_BASE, "inter-latin-ext-700-normal.woff")),
      fs.readFile(path.join(FONT_BASE, "inter-latin-ext-400-italic.woff")),
    ]);
    cachedRegular = reg;
    cachedBold = bold;
    cachedItalic = italic;
  }
  return {
    regular: cachedRegular,
    bold: cachedBold,
    italic: cachedItalic,
  };
}
