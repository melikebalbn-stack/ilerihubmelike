/**
 * Personel raporu hesap çekirdeği.
 *
 * /api/personnel/reports uç noktası VE haftalık personel maili bu tek kaynaktan
 * beslenir. Rapor ekranı ile mailin farklı sayılar göstermemesi için hesap
 * mantığı burada tutulur; uç nokta yalnız yetki kontrolü + JSON sarmalayıcıdır.
 */
import { prisma } from '@/lib/prisma'
import {
  DIGER_SUTUN, IMALAT_GRUPLARI, IMALAT_INDEKS, OFIS_GRUPLARI, OFIS_INDEKS, sutunBul,
} from '@/lib/personnel-bolum-gruplari'

export interface BolumSatir { bolum: string; sayi: number; oran: number }

/**
 * Direkt/Endirekt enum'u DÖRT değerli: DIREKT, A_DIREKT, ENDIREKT, B_ENDIREKT.
 * A_/B_ varyantları Excel import'undan gelir (A hep direkt, B hep endirekt —
 * bkz. api/personnel/import normalizeDirektEndirekt).
 *
 * 22.09.2026 hata düzeltmesi: eski kod yalnız 'DIREKT'/'ENDIREKT' sayıyordu;
 * A_DIREKT (6 kişi) ve B_ENDIREKT (59 kişi, beyaz yakanın TAMAMI) sessizce
 * düşüyordu → endirekt 44 görünüyordu, gerçek 103.
 */
const DIREKT_DEGERLER = ['DIREKT', 'A_DIREKT'] as const
const ENDIREKT_DEGERLER = ['ENDIREKT', 'B_ENDIREKT'] as const

type DirektEndirektDeger = string | null | undefined
export const direktMi = (v: DirektEndirektDeger): boolean => DIREKT_DEGERLER.includes(v as never)
export const endirektMi = (v: DirektEndirektDeger): boolean => ENDIREKT_DEGERLER.includes(v as never)

/** GMY tablolarının hücre tipi — sütun başlığı + sayı. */
export interface GrupHucre { baslik: string; sayi: number }

export interface ImalatTablosu {
  /** Sütun başlıkları, GMY sırasıyla; DİĞER doluysa en sonda. */
  sutunlar: string[]
  /** Satır adı → sütun başlığı → sayı. */
  satirlar: { ad: 'DİREK' | 'ENDİREK' | 'GRİ YAKA' | 'TOPLAM'; hucreler: GrupHucre[]; genelToplam: number }[]
}

export interface OfisTablosu {
  sutunlar: string[]
  satir: { ad: 'PERSONEL SAYISI'; hucreler: GrupHucre[]; genelToplam: number }
}

export type PersonelRaporVerisi = Awaited<ReturnType<typeof topluPersonelVerisi>>
export type PersonelRaporu = ReturnType<typeof hesaplaPersonelRaporu>

/** Rapor için gereken ham kayıtlar — aktif personel + aktif stajyer/danışman. */
export async function topluPersonelVerisi() {
  const [personnel, interns, consultants] = await Promise.all([
    prisma.personnel.findMany({
      where: { aktif: true },
      include: { sensitive: true },
    }),
    prisma.intern.findMany({ where: { aktif: true } }),
    prisma.consultant.findMany({ where: { aktif: true } }),
  ])
  return { personnel, interns, consultants }
}

/** Bir personel listesini bölüme göre dağıtır (çoktan aza). */
export function bolumDagilimi(
  liste: { bolum: string | null }[],
  toplam: number,
): BolumSatir[] {
  const harita: Record<string, number> = {}
  liste.forEach(p => {
    const anahtar = p.bolum || 'Belirtilmemiş'
    harita[anahtar] = (harita[anahtar] || 0) + 1
  })
  return Object.entries(harita)
    .sort((a, b) => b[1] - a[1])
    .map(([bolum, sayi]) => ({
      bolum,
      sayi,
      oran: toplam > 0 ? +(sayi / toplam * 100).toFixed(1) : 0,
    }))
}

export function hesaplaPersonelRaporu({ personnel, interns, consultants }: PersonelRaporVerisi) {
  const toplamCalisan = personnel.length
  const beyazYaka = personnel.filter(p => p.yakaRengi === 'BEYAZ').length
  const maviYaka = personnel.filter(p => p.yakaRengi === 'MAVI').length
  // Yaka Aşama 1: GRI yaka kategorisi (üretim birim sorumluları).
  const griYaka = personnel.filter(p => p.yakaRengi === 'GRI').length
  const direkt = personnel.filter(p => direktMi(p.direktEndirekt)).length
  const endirekt = personnel.filter(p => endirektMi(p.direktEndirekt)).length
  // Haftalık mailin özet kartı için MAVİ YAKA ile sınırlı kırılım (25.09.2026).
  // `direkt`/`endirekt` TÜM kadroyu sayar ve /personnel/reports ekranı, yüzde
  // kartı ve CSV dışa aktarımı onu kullanıyor — o yüzden DEĞİŞTİRİLMEDİ, yanına
  // ayrı alan eklendi.
  //
  // Neden yalnız MAVİ: imalat tablosunun DİREK/ENDİREK satırları da mavi yakayı
  // sayar; gri yaka orada direkt/endirekt'e BÖLÜNMEZ, kendi satırında durur.
  // Karta gri de eklenseydi (83/44) kart imalat tablosuyla çelişirdi.
  const maviKadro = personnel.filter(p => p.yakaRengi === 'MAVI')
  const maviDirekt = maviKadro.filter(p => direktMi(p.direktEndirekt)).length
  const maviEndirekt = maviKadro.filter(p => endirektMi(p.direktEndirekt)).length

  // Cinsiyet dagilimi
  const erkek = personnel.filter(p => p.cinsiyet === 'MALE').length
  const kadin = personnel.filter(p => p.cinsiyet === 'FEMALE').length

  // Yaka-Cinsiyet cross tabulation
  const beyazPersonel = personnel.filter(p => p.yakaRengi === 'BEYAZ')
  const maviPersonel = personnel.filter(p => p.yakaRengi === 'MAVI')
  const griPersonel = personnel.filter(p => p.yakaRengi === 'GRI')

  const yakaCinsiyetTablosu = {
    beyaz: {
      genel: beyazPersonel.length,
      erkek: beyazPersonel.filter(p => p.cinsiyet === 'MALE').length,
      kadin: beyazPersonel.filter(p => p.cinsiyet === 'FEMALE').length,
      engelli: beyazPersonel.filter(p => p.engelli === true).length,
    },
    mavi: {
      genel: maviPersonel.length,
      erkek: maviPersonel.filter(p => p.cinsiyet === 'MALE').length,
      kadin: maviPersonel.filter(p => p.cinsiyet === 'FEMALE').length,
      engelli: maviPersonel.filter(p => p.engelli === true).length,
    },
    gri: {
      genel: griPersonel.length,
      erkek: griPersonel.filter(p => p.cinsiyet === 'MALE').length,
      kadin: griPersonel.filter(p => p.cinsiyet === 'FEMALE').length,
      engelli: griPersonel.filter(p => p.engelli === true).length,
    },
    toplam: {
      genel: toplamCalisan,
      erkek,
      kadin,
      engelli: personnel.filter(p => p.engelli === true).length,
    },
  }

  const beyazYakaBolumler = bolumDagilimi(beyazPersonel, beyazYaka)
  const maviYakaBolumler = bolumDagilimi(maviPersonel, maviYaka)
  const griYakaBolumler = bolumDagilimi(griPersonel, griYaka)
  const direktBolumler = bolumDagilimi(personnel.filter(p => direktMi(p.direktEndirekt)), direkt)
  const endirektBolumler = bolumDagilimi(personnel.filter(p => endirektMi(p.direktEndirekt)), endirekt)
  /** Tüm aktif personelin bölüm dağılımı — haftalık mailin bar listesi bunu kullanır. */
  const tumBolumler = bolumDagilimi(personnel, toplamCalisan)

  const imalatTablosu = hesaplaImalatTablosu(personnel)
  const ofisTablosu = hesaplaOfisTablosu(personnel)

  // Istatistikler
  const now = new Date()

  const muhendisler = personnel.filter(p => {
    const gorev = (p.gorev || '').toUpperCase()
    return gorev.includes('MUHENDIS') || gorev.includes('MÜHENDİS')
  })
  const muhendisSayisi = muhendisler.length
  const muhendisOrani = toplamCalisan > 0 ? +(muhendisSayisi / toplamCalisan * 100).toFixed(1) : 0

  let muhendislerOrtCalismaSuresi = 0
  if (muhendisler.length > 0) {
    const toplamYil = muhendisler.reduce((sum, p) => {
      if (p.iseGirisTarihi) {
        const giris = new Date(p.iseGirisTarihi)
        const yil = (now.getTime() - giris.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        return sum + yil
      }
      return sum
    }, 0)
    muhendislerOrtCalismaSuresi = +(toplamYil / muhendisler.length).toFixed(1)
  }

  const argeCalisanlar = personnel.filter(p => {
    const bolum = (p.bolum || '').toUpperCase()
    const bolumDetay = (p.bolumDetay || '').toUpperCase()
    return bolum.includes('MÜHENDİS') || bolum.includes('MUHENDIS') ||
      bolumDetay.includes('ARGE') || bolumDetay.includes('AR-GE')
  })
  const argeCalisanOrani = toplamCalisan > 0 ? +(argeCalisanlar.length / toplamCalisan * 100).toFixed(1) : 0

  const yuksekLisansMezunlar = personnel.filter(p => {
    const tip = (p.egitimTipi || '').toUpperCase()
    return tip.includes('Y.L') || tip.includes('YÜKSEK LİSANS') ||
      tip.includes('MASTER') || tip.includes('DOKTORA') || tip.includes('LİSANS')
  })
  const yulesekLisansMezunOrani = toplamCalisan > 0 ? +(yuksekLisansMezunlar.length / toplamCalisan * 100).toFixed(1) : 0

  const kadinErkekOrani = toplamCalisan > 0 ? +(kadin / toplamCalisan * 100).toFixed(1) : 0
  // Hesap: beyazYaka / TÜM personel — beyaz yakanın toplam içindeki payı.
  const beyazYakaOrani = toplamCalisan > 0 ? +(beyazYaka / toplamCalisan * 100).toFixed(1) : 0

  const asansorSayisi = personnel.filter(p => p.asansorMekanik === 'ASANSOR').length
  const mekanikSayisi = personnel.filter(p => p.asansorMekanik === 'MEKANIK').length
  const yokSayisi = personnel.filter(p => p.asansorMekanik === 'YOK' || !p.asansorMekanik).length

  const asansorPersonel = personnel.filter(p =>
    (p.bolum || '').toUpperCase().includes('ASANSÖR') ||
    (p.bolum || '').toUpperCase().includes('ASANSOR')
  )
  const asansorMavi = asansorPersonel.filter(p => p.yakaRengi === 'MAVI').length
  const asansorBeyaz = asansorPersonel.filter(p => p.yakaRengi === 'BEYAZ').length

  return {
    ozet: { toplamCalisan, beyazYaka, maviYaka, griYaka, direkt, endirekt, maviDirekt, maviEndirekt },
    cinsiyetDagilimi: { erkek, kadin },
    yakaCinsiyetTablosu,
    imalatTablosu,
    ofisTablosu,
    beyazYakaBolumler,
    maviYakaBolumler,
    griYakaBolumler,
    direktBolumler,
    endirektBolumler,
    tumBolumler,
    istatistik: {
      kadinErkekOrani,
      beyazYakaOrani,
      muhendislerOrtCalismaSuresi,
      muhendisSayisi,
      muhendisOrani,
      argeCalisanOrani,
      yulesekLisansMezunOrani,
    },
    asansorMekanik: {
      asansor: asansorSayisi,
      mekanik: mekanikSayisi,
      yok: yokSayisi,
    },
    ozelGrup: {
      asansorMavi,
      asansorBeyaz,
      stajyerAktif: interns.length,
      danismanAktif: consultants.length,
    },
  }
}

// ── GMY tabloları ──────────────────────────────────────────────────────────

type YakaliPersonel = { bolum: string | null; bolumDetay: string | null; yakaRengi: string | null; direktEndirekt: string | null }

/** Sütun listesini kurar: harita sırası + (varsa) DİĞER en sonda. */
function sutunlariKur(gruplar: { baslik: string }[], digerVar: boolean): string[] {
  const s = gruplar.map(g => g.baslik)
  return digerVar ? [...s, DIGER_SUTUN] : s
}

function sayimHaritasi(sutunlar: string[]): Map<string, number> {
  return new Map(sutunlar.map(s => [s, 0]))
}

function hucrelere(sutunlar: string[], sayim: Map<string, number>): { hucreler: GrupHucre[]; genelToplam: number } {
  const hucreler = sutunlar.map(baslik => ({ baslik, sayi: sayim.get(baslik) ?? 0 }))
  return { hucreler, genelToplam: hucreler.reduce((t, h) => t + h.sayi, 0) }
}

/**
 * İmalat tablosu — MAVİ + GRİ yakalılar.
 *
 * Satırlar ÖRTÜŞMEZ (toplam iki kez saymaz):
 *   DİREK    = mavi yaka ∧ direkt
 *   ENDİREK  = mavi yaka ∧ endirekt
 *   GRİ YAKA = gri yakanın TAMAMI (direkt/endirekt ayrımı yapılmaz)
 *   TOPLAM   = DİREK + ENDİREK + GRİ YAKA
 */
export function hesaplaImalatTablosu(personnel: YakaliPersonel[]): ImalatTablosu {
  const kapsam = personnel.filter(p => p.yakaRengi === 'MAVI' || p.yakaRengi === 'GRI')
  const digerVar = kapsam.some(p => sutunBul(IMALAT_INDEKS, p.bolum, p.bolumDetay) === DIGER_SUTUN)
  const sutunlar = sutunlariKur(IMALAT_GRUPLARI, digerVar)

  const direk = sayimHaritasi(sutunlar)
  const endirek = sayimHaritasi(sutunlar)
  const gri = sayimHaritasi(sutunlar)

  for (const p of kapsam) {
    const sutun = sutunBul(IMALAT_INDEKS, p.bolum, p.bolumDetay)
    if (p.yakaRengi === 'GRI') gri.set(sutun, (gri.get(sutun) ?? 0) + 1)
    else if (direktMi(p.direktEndirekt)) direk.set(sutun, (direk.get(sutun) ?? 0) + 1)
    else endirek.set(sutun, (endirek.get(sutun) ?? 0) + 1)
  }

  const toplam = sayimHaritasi(sutunlar)
  for (const s of sutunlar) toplam.set(s, (direk.get(s) ?? 0) + (endirek.get(s) ?? 0) + (gri.get(s) ?? 0))

  return {
    sutunlar,
    satirlar: [
      { ad: 'DİREK', ...hucrelere(sutunlar, direk) },
      { ad: 'ENDİREK', ...hucrelere(sutunlar, endirek) },
      { ad: 'GRİ YAKA', ...hucrelere(sutunlar, gri) },
      { ad: 'TOPLAM', ...hucrelere(sutunlar, toplam) },
    ],
  }
}

/** Ofis tablosu — yalnız BEYAZ yakalılar, tek satır. */
export function hesaplaOfisTablosu(personnel: YakaliPersonel[]): OfisTablosu {
  const kapsam = personnel.filter(p => p.yakaRengi === 'BEYAZ')
  const digerVar = kapsam.some(p => sutunBul(OFIS_INDEKS, p.bolum, p.bolumDetay) === DIGER_SUTUN)
  const sutunlar = sutunlariKur(OFIS_GRUPLARI, digerVar)

  const sayim = sayimHaritasi(sutunlar)
  for (const p of kapsam) {
    const sutun = sutunBul(OFIS_INDEKS, p.bolum, p.bolumDetay)
    sayim.set(sutun, (sayim.get(sutun) ?? 0) + 1)
  }

  return { sutunlar, satir: { ad: 'PERSONEL SAYISI', ...hucrelere(sutunlar, sayim) } }
}
