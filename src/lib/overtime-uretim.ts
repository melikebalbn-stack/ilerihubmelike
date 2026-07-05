/**
 * Faz 1 — çift yazma yardımcıları: OvertimePersonnel tekil alanları <-> çoklu
 * OvertimePersonnelUretim satırları arasındaki normalize/senkron mantığı.
 *
 * PROD GERÇEĞİ (dry-run ile doğrulandı): parça kodu `mesaiNedeni` alanına girilmiş;
 * `targetProduction` %100 boş ve retired. Eşleme:
 *   parcaKodu        <- mesaiNedeni          (satırın ana alanı, NOT NULL)
 *   mesaiNedeni(yeni)<- (ayrı gerekçe alanı; current UI'da yok → null)
 *   hedefAdet        <- hedefAdet            (nullable; API'de > 0 zorunlu, backfill null taşır)
 *   gerceklesenAdet  <- gerceklesenAdet
 *   gerceklesenNote  <- gerceklesenNote
 *   hurdaAdet        -> (tekil karşılığı yok, yalnız satırda)
 *
 * İKİ BAĞLAM — hedefAdet kuralı farklı:
 *   - API create/update (buildUretimRows/buildSingles): hedefAdet > 0 zorunlu
 *     (coerceHedefPozitif); satır ancak parcaKodu + hedefAdet(>0) ile oluşur.
 *   - Backfill (buildBackfillRow): parcaKodu doluysa satır oluşur; hedefAdet null ise
 *     null taşınır (tarihsel kayıtlar satırsız kalmasın; Faz 3 drop'ta kayıp olmasın).
 *
 * Geri uyumluluk: UI (Faz 2) henüz `uretimSatirlari` göndermiyor. Payload'da yoksa
 * tekil alanlardan 1 satır türetilir; varsa satırlar esas, 1. satır tekil alanlara yansır.
 */

export interface UretimRowInput {
  parcaKodu?: string | null
  mesaiNedeni?: string | null
  hedefAdet?: number | string | null
  gerceklesenAdet?: number | string | null
  gerceklesenNote?: string | null
  hurdaAdet?: number | string | null
  sira?: number | string | null
}

export interface OvertimePersonnelInput {
  // NOT: targetProduction retired — okunmaz. Parça kodu mesaiNedeni'de.
  mesaiNedeni?: string | null
  hedefAdet?: number | string | null
  gerceklesenAdet?: number | string | null
  gerceklesenNote?: string | null
  uretimSatirlari?: UretimRowInput[]
}

export interface NormalizedUretimRow {
  parcaKodu: string
  mesaiNedeni: string | null
  hedefAdet: number | null
  gerceklesenAdet: number | null
  gerceklesenNote: string | null
  hurdaAdet: number | null
  sira: number
}

export interface NormalizedSingles {
  mesaiNedeni: string | null
  hedefAdet: number | null
}

/** Sonlu ve >= 0 ise trunc; değilse null. (hurdaAdet, gerceklesenAdet ve tekil hedefAdet için) */
export function coerceIntNonNeg(v: unknown): number | null {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.trunc(n)
}

/** API satır hedefAdet: > 0 zorunlu. Aksi halde null. */
export function coerceHedefPozitif(v: unknown): number | null {
  const n = coerceIntNonNeg(v)
  return n != null && n > 0 ? n : null
}

function trimOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Payload'da açık üretim satırları var mı? */
function hasExplicitRows(p: OvertimePersonnelInput): boolean {
  return Array.isArray(p.uretimSatirlari) && p.uretimSatirlari.length > 0
}

/**
 * API (create/update) için geçerli üretim satırları. Zorunlu alanlar: parcaKodu (boş
 * olamaz) + hedefAdet (> 0). Legacy payload'da parcaKodu mesaiNedeni'den gelir.
 */
export function buildUretimRows(p: OvertimePersonnelInput): NormalizedUretimRow[] {
  const raw: UretimRowInput[] = hasExplicitRows(p)
    ? (p.uretimSatirlari as UretimRowInput[])
    : [
        {
          // Legacy: parça kodu mesaiNedeni'de; satırın ayrı gerekçe alanı yok.
          parcaKodu: p.mesaiNedeni ?? null,
          mesaiNedeni: null,
          hedefAdet: p.hedefAdet ?? null,
          gerceklesenAdet: p.gerceklesenAdet ?? null,
          gerceklesenNote: p.gerceklesenNote ?? null,
        },
      ]

  const rows: NormalizedUretimRow[] = []
  raw.forEach((r, i) => {
    const parcaKodu = String(r.parcaKodu ?? '').trim()
    const hedefAdet = coerceHedefPozitif(r.hedefAdet)
    if (parcaKodu === '' || hedefAdet == null) return // API bağlamı: parcaKodu + hedefAdet(>0) zorunlu
    const siraNum = Number(r.sira)
    rows.push({
      parcaKodu,
      mesaiNedeni: trimOrNull(r.mesaiNedeni),
      hedefAdet,
      gerceklesenAdet: coerceIntNonNeg(r.gerceklesenAdet),
      gerceklesenNote: trimOrNull(r.gerceklesenNote),
      hurdaAdet: coerceIntNonNeg(r.hurdaAdet),
      sira: Number.isFinite(siraNum) && siraNum > 0 ? Math.trunc(siraNum) : i + 1,
    })
  })
  return rows
}

/**
 * OvertimePersonnel tekil alanları (create/update sırasında yazılacak). targetProduction
 * ARTIK YAZILMAZ. `uretimSatirlari` geldiyse 1. geçerli satırdan; yoksa legacy tekil
 * alanlardan türetilir. Tekil `mesaiNedeni` geri uyumluluk için parça kodunu taşımayı
 * sürdürür (Faz 3'te drop).
 */
export function buildSingles(p: OvertimePersonnelInput): NormalizedSingles {
  if (hasExplicitRows(p)) {
    const rows = buildUretimRows(p)
    if (rows.length > 0) {
      const r = rows[0]
      // Tekil mesaiNedeni = 1. satırın parça kodu (kod geri uyumlulukla burada tutulur).
      return { mesaiNedeni: r.parcaKodu, hedefAdet: r.hedefAdet }
    }
    return { mesaiNedeni: null, hedefAdet: null }
  }
  // Legacy — mevcut davranışla birebir (mesaiNedeni = parça kodu serbest metni).
  return {
    mesaiNedeni: trimOrNull(p.mesaiNedeni),
    hedefAdet: coerceIntNonNeg(p.hedefAdet),
  }
}

/** Backfill kaynak kaydı (OvertimePersonnel tekil alanları). */
export interface BackfillSource {
  mesaiNedeni?: string | null
  hedefAdet?: number | null
  gerceklesenAdet?: number | null
  gerceklesenNote?: string | null
}

/**
 * Backfill satırı: parcaKodu (<- mesaiNedeni) doluysa 1 satır üretir; hedefAdet null ise
 * NULL taşır (API'nin > 0 kuralından farklı — tarihsel kayıtlar satırsız kalmasın).
 * parcaKodu boşsa null döner (kayıt atlanır).
 */
export function buildBackfillRow(rec: BackfillSource): NormalizedUretimRow | null {
  const parcaKodu = String(rec.mesaiNedeni ?? '').trim()
  if (parcaKodu === '') return null
  return {
    parcaKodu,
    mesaiNedeni: null, // tarihsel gerekçe yok; kod parcaKodu'na taşındı
    hedefAdet: coerceIntNonNeg(rec.hedefAdet), // null ise null taşınır
    gerceklesenAdet: coerceIntNonNeg(rec.gerceklesenAdet),
    gerceklesenNote: trimOrNull(rec.gerceklesenNote),
    hurdaAdet: null,
    sira: 1,
  }
}
