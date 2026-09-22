/**
 * İkamet adresi değişim damgası — TEK KAYNAK (Melih kararı, 22.09.2026).
 *
 * Personnel.ikametAdresi'ni yazan HER yol (put-govde.ts, toplu Excel import,
 * personele-donustur.ts yeniden-işe-alım) bu yardımcıdan geçmeli — aksi
 * halde ikametAdresiDegisimTarihi bazı yollarda sessizce bayatlar ve
 * "adres değişmedi" diyen ama aslında değişmiş bir uyarı sistemi üretir
 * (yanlış-negatif, hiç olmayan uyarı sisteminden daha kötü).
 *
 * Yalnız GERÇEK değişiklikte (trim sonrası eski !== yeni) damga basılır;
 * no-op'ta dönen boş nesne spread edildiğinde hiçbir alanı DOKUNMAZ.
 */

function normalize(deger: string | null | undefined): string | null {
  if (typeof deger !== 'string') return null
  const trimmed = deger.trim()
  return trimmed === '' ? null : trimmed
}

export function adresDegisimDamgasi(
  eskiAdres: string | null | undefined,
  yeniAdres: string | null | undefined,
): { ikametAdresiDegisimTarihi: Date } | Record<string, never> {
  if (normalize(eskiAdres) === normalize(yeniAdres)) return {}
  return { ikametAdresiDegisimTarihi: new Date() }
}
