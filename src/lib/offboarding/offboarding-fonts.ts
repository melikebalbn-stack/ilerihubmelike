import fs from 'fs/promises'
import path from 'path'

/**
 * OFFB-4 PDF fontları — STATİK TTF (pdf-lib + fontkit static .ttf/.otf ister).
 *
 * NOT: akademi certificate-fonts.ts @fontsource/inter'ın `latin-ext` WOFF
 * subset'ini okuyor; o dosya yalnız Latin-Extended glyph'leri (İ ş ğ) içerir,
 * temel Latin (a-z, 0-9) ve ç/ö/ü/ı GLYPH'lerini İÇERMEZ → metin tofu (boş
 * kutu) render olur. Bu yüzden OFFB-4 repo'daki tam-kapsamlı statik
 * Poppins TTF'ini kullanır (public/fonts; tüm Türkçe karakterleri kapsar).
 */
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')

let cachedRegular: Buffer | null = null
let cachedBold: Buffer | null = null

export async function loadOffboardingFonts() {
  if (!cachedRegular || !cachedBold) {
    const [reg, bold] = await Promise.all([
      fs.readFile(path.join(FONT_DIR, 'Poppins-Regular.ttf')),
      fs.readFile(path.join(FONT_DIR, 'Poppins-Bold.ttf')),
    ])
    cachedRegular = reg
    cachedBold = bold
  }
  return { regular: cachedRegular, bold: cachedBold }
}
