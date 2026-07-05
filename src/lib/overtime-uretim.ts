/**
 * Faz 1 — çift yazma yardımcıları: OvertimePersonnel tekil alanları <-> çoklu
 * OvertimePersonnelUretim satırları arasındaki normalize/senkron mantığı.
 *
 * Kaynak eşlemesi:
 *   parcaKodu        <-> targetProduction   (satırın ana alanı, NOT NULL)
 *   mesaiNedeni      <-> mesaiNedeni         (gerekçe, nullable)
 *   hedefAdet        <-> hedefAdet           (satırda > 0 zorunlu)
 *   gerceklesenAdet  <-> gerceklesenAdet
 *   gerceklesenNote  <-> gerceklesenNote
 *   hurdaAdet        -> (tekil karşılığı yok, yalnız satırda)
 *
 * Geri uyumluluk: UI (Faz 2) henüz `uretimSatirlari` göndermiyor. Payload'da yoksa
 * tekil alanlardan 1 satır türetilir; varsa satırlar esas alınır, 1. satır tekil
 * alanlara yansıtılır (Faz 3'te tekil alanlar drop edilecek).
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
  targetProduction?: string | null
  mesaiNedeni?: string | null
  hedefAdet?: number | string | null
  gerceklesenAdet?: number | string | null
  gerceklesenNote?: string | null
  uretimSatirlari?: UretimRowInput[]
}

export interface NormalizedUretimRow {
  parcaKodu: string
  mesaiNedeni: string | null
  hedefAdet: number
  gerceklesenAdet: number | null
  gerceklesenNote: string | null
  hurdaAdet: number | null
  sira: number
}

export interface NormalizedSingles {
  targetProduction: string | null
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

/** Satır hedefAdet: > 0 zorunlu (task validasyonu). Aksi halde null. */
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
 * Geçerli (yeni tabloya yazılabilir) üretim satırlarını üretir.
 * Zorunlu alanlar: parcaKodu (boş olamaz) + hedefAdet (> 0). Sağlanamayan satır atlanır.
 */
export function buildUretimRows(p: OvertimePersonnelInput): NormalizedUretimRow[] {
  const raw: UretimRowInput[] = hasExplicitRows(p)
    ? (p.uretimSatirlari as UretimRowInput[])
    : [
        {
          parcaKodu: p.targetProduction ?? null,
          mesaiNedeni: p.mesaiNedeni ?? null,
          hedefAdet: p.hedefAdet ?? null,
          gerceklesenAdet: p.gerceklesenAdet ?? null,
          gerceklesenNote: p.gerceklesenNote ?? null,
        },
      ]

  const rows: NormalizedUretimRow[] = []
  raw.forEach((r, i) => {
    const parcaKodu = String(r.parcaKodu ?? '').trim()
    const hedefAdet = coerceHedefPozitif(r.hedefAdet)
    if (parcaKodu === '' || hedefAdet == null) return // geçersiz satır — atla
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
 * OvertimePersonnel tekil alanları (create/update sırasında yazılacak) — form
 * oluşturma/düzenlemede geçerli olan 3 alan. `uretimSatirlari` geldiyse 1. geçerli
 * satırdan; yoksa legacy tekil alanlardan (mevcut davranışla birebir) türetilir.
 */
export function buildSingles(p: OvertimePersonnelInput): NormalizedSingles {
  if (hasExplicitRows(p)) {
    const rows = buildUretimRows(p)
    if (rows.length > 0) {
      const r = rows[0]
      return { targetProduction: r.parcaKodu, mesaiNedeni: r.mesaiNedeni, hedefAdet: r.hedefAdet }
    }
    // Açık satır geldi ama hiçbiri geçerli değil → tekil alanları boşalt.
    return { targetProduction: null, mesaiNedeni: null, hedefAdet: null }
  }
  // Legacy — mevcut create/update davranışıyla birebir (targetProduction trim'lenmez).
  return {
    targetProduction: p.targetProduction || null,
    mesaiNedeni: trimOrNull(p.mesaiNedeni),
    hedefAdet: coerceIntNonNeg(p.hedefAdet),
  }
}
