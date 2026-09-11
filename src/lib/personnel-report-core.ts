/**
 * Personel raporu hesap çekirdeği.
 *
 * /api/personnel/reports uç noktası VE haftalık personel maili bu tek kaynaktan
 * beslenir. Rapor ekranı ile mailin farklı sayılar göstermemesi için hesap
 * mantığı burada tutulur; uç nokta yalnız yetki kontrolü + JSON sarmalayıcıdır.
 */
import { prisma } from '@/lib/prisma'

export interface BolumSatir { bolum: string; sayi: number; oran: number }

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
  const direkt = personnel.filter(p => p.direktEndirekt === 'DIREKT').length
  const endirekt = personnel.filter(p => p.direktEndirekt === 'ENDIREKT').length

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
  const direktBolumler = bolumDagilimi(personnel.filter(p => p.direktEndirekt === 'DIREKT'), direkt)
  const endirektBolumler = bolumDagilimi(personnel.filter(p => p.direktEndirekt === 'ENDIREKT'), endirekt)
  /** Tüm aktif personelin bölüm dağılımı — haftalık mailin bar listesi bunu kullanır. */
  const tumBolumler = bolumDagilimi(personnel, toplamCalisan)

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
    ozet: { toplamCalisan, beyazYaka, maviYaka, griYaka, direkt, endirekt },
    cinsiyetDagilimi: { erkek, kadin },
    yakaCinsiyetTablosu,
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
