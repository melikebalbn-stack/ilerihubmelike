// MASTER Madde 29 — Operasyonel Servis Listeleri Excel export'u. Desen:
// src/lib/quality/uygunsuzluk-excel.ts + src/app/api/quality/uygunsuzluk/
// export/route.ts (satır bazlı düz tablo, xlsx doğrudan, route içinde
// fetch + bu dosyadan saf builder). src/lib/servis-yonetimi/export.ts'e
// KASITLI olarak dokunulmadı — o dosya başka (henüz main'e girmemiş) bir
// dalda; bu dosya tamamen bağımsız, birleştirmede çakışma yüzeyi sıfır.
import type { OperasyonelServisListesiSatiri } from './operasyonel-servis-listesi'

export const EXPORT_HEADERS = ['SİCİL', 'AD SOYAD', 'BÖLÜM', 'SERVİS', 'DURAK', 'SABAH SAATİ', 'TELEFON'] as const

function tarihTR(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
}

/** gecmisTarihSecildi=true iken Excel'in İÇİNE yazılacak uyarı metni — ekran
 * dışında (servis firmasına giden dosyanın içinde) da görünür olması için. */
export function gecmisTarihNotuOlustur(tarihIso: string): string {
  return `Personel listesi ${tarihTR(tarihIso)} itibarıyla; saat ve durak bilgileri güncel tanımlara göredir.`
}

/**
 * Satırları Excel'in beklediği düz (string|number)[][] biçimine çevirir.
 * `not` verilirse (gecmisTarihSecildi=true) başlık satırından ÖNCE, ayrı bir
 * satır + boş bir ayraç satırı olarak eklenir — dosya uygulamanın dışında
 * açıldığında da uyarı gözden kaçmasın diye.
 */
export function operasyonelServisListesiSatirlariOlustur(
  satirlar: OperasyonelServisListesiSatiri[],
  not?: string,
): (string | number)[][] {
  const rows: (string | number)[][] = []
  if (not) {
    rows.push([not])
    rows.push([])
  }
  rows.push([...EXPORT_HEADERS])
  for (const s of satirlar) {
    rows.push([
      s.sicilNo ?? '',
      s.adSoyad,
      s.bolum ?? '',
      `${s.guzergahKod} — ${s.guzergahAd}`,
      s.durakKod ? `${s.durakKod} — ${s.durakAd}` : '',
      s.sabahSaati ?? '',
      s.telefon ?? '',
    ])
  }
  return rows
}
