// Servis Yönetimi Excel/PDF export'ları — ortak sabitler ve saf (DB'siz)
// satır/sayfa oluşturma fonksiyonları. Desen: src/lib/quality/uygunsuzluk-excel.ts
// + src/app/api/quality/uygunsuzluk/export/route.ts (satır bazlı düz tablo,
// XLSX.utils.aoa_to_sheet, route içinde fetch + bu dosyadan saf builder).
//
// Ayrım gerekçesi: DB sorgusu route.ts'te kalır (mock'lu route testi hızlı),
// satır biçimlendirme mantığı burada saf fonksiyon olarak test edilir
// (prisma mock'lamaya gerek kalmaz).

function tarihTR(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toLocaleDateString('tr-TR', { timeZone: 'UTC' })
}

// ── Adım 1: Tüm Servis Listesi (güzergah bazlı özet) ────────────────────────
// "Tüm servis listesi" = tüm güzergahların (aktif+pasif) özet tablosu — tek
// bir güzergahın DETAYI (durak sırası/saatler/atamalar) değil, o PDF export'u
// ayrı bir adım (3). Bu yorum açık uçlu bir talimattan geldi, netlik için not.
export const GUZERGAH_LISTESI_HEADERS = [
  'KOD',
  'AD',
  'BÖLGE',
  'YERLEŞKE',
  'DURAK SAYISI',
  'GEÇERLİLİK BAŞLANGICI',
  'GEÇERLİLİK BİTİŞİ',
  'DURUM',
] as const

export type GuzergahListesiKaynak = {
  kod: string
  ad: string
  bolge: string | null
  aktif: boolean
  gecerlilikBaslangici: Date | null
  gecerlilikBitisi: Date | null
  yerleske: { kod: string; ad: string }
  _count: { duraklar: number }
}

export function guzergahListesiSatirlariOlustur(guzergahlar: GuzergahListesiKaynak[]): (string | number)[][] {
  const rows: (string | number)[][] = [[...GUZERGAH_LISTESI_HEADERS]]
  for (const g of guzergahlar) {
    rows.push([
      g.kod,
      g.ad,
      g.bolge ?? '',
      `${g.yerleske.kod} — ${g.yerleske.ad}`,
      g._count.duraklar,
      tarihTR(g.gecerlilikBaslangici),
      tarihTR(g.gecerlilikBitisi),
      g.aktif ? 'Aktif' : 'Pasif',
    ])
  }
  return rows
}
