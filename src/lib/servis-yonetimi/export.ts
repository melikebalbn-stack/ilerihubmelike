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

// ── Adım 3: Güzergah Bazlı Detay (PDF) ──────────────────────────────────────
// Kapsam notu: "kapasite özeti" bölümü BİLEREK YOK — kapasite motoru
// (dev/elif/servis-yonetimi-faz1b-kapasite-motoru) henüz main'e girmedi,
// export dalı ona bağımlı hale getirilmeyecek (Elif'in kararı — Adım 2 de
// aynı gerekçeyle bekletiliyor). Motor main'e girip export dalı
// güncellenince buraya eklenecek.
//
// Bu bölümdeki fonksiyonlar PDF ÜRETMEZ (bkz. src/lib/pdf/guzergah-detay-pdf.ts)
// — yalnız ham Prisma sonucunu PDF'in beklediği düz/okunabilir şekle
// (DTO) dönüştürür, DB'siz test edilir.

export type DilimYon = 'GIDIS' | 'DONUS'

export function dilimEtiketi(dilim: { kod: string; yon: DilimYon }): string {
  return `${dilim.kod} (${dilim.yon === 'GIDIS' ? 'Gidiş' : 'Dönüş'})`
}

export type GuzergahDetayDurakKaynak = {
  sira: number
  durak: { kod: string; ad: string }
  saatler: { saat: string; dilim: { kod: string; yon: DilimYon } }[]
}

export type GuzergahDetayDurakSatiri = {
  sira: number
  durakKod: string
  durakAd: string
  saatlerMetni: string
}

export function guzergahDetayDuraklariniHazirla(duraklar: GuzergahDetayDurakKaynak[]): GuzergahDetayDurakSatiri[] {
  return duraklar.map((d) => ({
    sira: d.sira,
    durakKod: d.durak.kod,
    durakAd: d.durak.ad,
    saatlerMetni: d.saatler.length > 0 ? d.saatler.map((s) => `${dilimEtiketi(s.dilim)}: ${s.saat}`).join(', ') : '—',
  }))
}

export type GuzergahDetayAracKaynak = { dilim: { kod: string; yon: DilimYon }; arac: { plaka: string; kapasite: number }; rol: string }
export type GuzergahDetayAracSatiri = { dilimEtiket: string; plaka: string; kapasite: number; rol: string }

export function guzergahDetayAracAtamalariniHazirla(atamalar: GuzergahDetayAracKaynak[]): GuzergahDetayAracSatiri[] {
  return atamalar.map((a) => ({ dilimEtiket: dilimEtiketi(a.dilim), plaka: a.arac.plaka, kapasite: a.arac.kapasite, rol: a.rol }))
}

export type GuzergahDetaySoforKaynak = { dilim: { kod: string; yon: DilimYon }; sofor: { adSoyad: string }; rol: string }
export type GuzergahDetaySoforSatiri = { dilimEtiket: string; adSoyad: string; rol: string }

export function guzergahDetaySoforAtamalariniHazirla(atamalar: GuzergahDetaySoforKaynak[]): GuzergahDetaySoforSatiri[] {
  return atamalar.map((a) => ({ dilimEtiket: dilimEtiketi(a.dilim), adSoyad: a.sofor.adSoyad, rol: a.rol }))
}

export type GuzergahDetayPdfData = {
  guzergah: {
    kod: string
    ad: string
    bolge: string | null
    aktif: boolean
    gecerlilikBaslangici: Date | null
    gecerlilikBitisi: Date | null
    yerleske: { kod: string; ad: string }
  }
  duraklar: GuzergahDetayDurakSatiri[]
  aracAtamalari: GuzergahDetayAracSatiri[]
  soforAtamalari: GuzergahDetaySoforSatiri[]
}
