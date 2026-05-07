import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

const REPORT_ROLES = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

export async function GET() {
  try {
    // PR-PERSONNEL-SECURITY: HR-only role check (rapor TC/SGK içeren sensitive data dahil)
    const { user, error } = await requireUser()
    if (error) return error

    if (!REPORT_ROLES.includes(user.role) && !isHRDepartment(user.department)) {
      return NextResponse.json(
        { error: 'Personnel raporu için HR_MANAGER veya admin yetkisi gerekli' },
        { status: 403 }
      )
    }

    const [personnel, interns, consultants] = await Promise.all([
      prisma.personnel.findMany({
        where: { aktif: true },
        include: { sensitive: true },
      }),
      prisma.intern.findMany({ where: { aktif: true } }),
      prisma.consultant.findMany({ where: { aktif: true } }),
    ])

    const toplamCalisan = personnel.length
    const beyazYaka = personnel.filter(p => p.yakaRengi === 'BEYAZ').length
    const maviYaka = personnel.filter(p => p.yakaRengi === 'MAVI').length
    const direkt = personnel.filter(p => p.direktEndirekt === 'DIREKT').length
    const endirekt = personnel.filter(p => p.direktEndirekt === 'ENDIREKT').length

    // Cinsiyet dagilimi
    const erkek = personnel.filter(p => p.cinsiyet === 'MALE').length
    const kadin = personnel.filter(p => p.cinsiyet === 'FEMALE').length

    // Yaka-Cinsiyet cross tabulation
    const beyazPersonel = personnel.filter(p => p.yakaRengi === 'BEYAZ')
    const maviPersonel = personnel.filter(p => p.yakaRengi === 'MAVI')

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
      toplam: {
        genel: toplamCalisan,
        erkek,
        kadin,
        engelli: personnel.filter(p => p.engelli === true).length,
      },
    }

    // Bolum dagilimi: Beyaz Yaka by bolum (liste filtresiyle aynı)
    const beyazBolumMap: Record<string, number> = {}
    beyazPersonel.forEach(p => {
      const key = p.bolum || 'Belirtilmemiş'
      beyazBolumMap[key] = (beyazBolumMap[key] || 0) + 1
    })
    const beyazYakaBolumler = Object.entries(beyazBolumMap)
      .sort((a, b) => b[1] - a[1])
      .map(([bolum, sayi]) => ({
        bolum,
        sayi,
        oran: beyazYaka > 0 ? +(sayi / beyazYaka * 100).toFixed(1) : 0,
      }))

    // Bolum dagilimi: Mavi Yaka by bolum (liste filtresiyle aynı)
    const maviBolumMap: Record<string, number> = {}
    maviPersonel.forEach(p => {
      const key = p.bolum || 'Belirtilmemiş'
      maviBolumMap[key] = (maviBolumMap[key] || 0) + 1
    })
    const maviYakaBolumler = Object.entries(maviBolumMap)
      .sort((a, b) => b[1] - a[1])
      .map(([bolum, sayi]) => ({
        bolum,
        sayi,
        oran: maviYaka > 0 ? +(sayi / maviYaka * 100).toFixed(1) : 0,
      }))

    // Direkt/Endirekt bolum dagilimi
    const direktBolumler = personnel
      .filter(p => p.direktEndirekt === 'DIREKT')
      .reduce((acc: Record<string, number>, p) => {
        const key = p.bolum || 'Belirtilmemis'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})

    const endirektBolumler = personnel
      .filter(p => p.direktEndirekt === 'ENDIREKT')
      .reduce((acc: Record<string, number>, p) => {
        const key = p.bolum || 'Belirtilmemis'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})

    // Istatistikler
    const now = new Date()

    // Muhendis hesaplamalari
    const muhendisler = personnel.filter(p => {
      const gorev = (p.gorev || '').toUpperCase()
      return gorev.includes('MUHENDIS') || gorev.includes('M\u00dcHEND\u0130S')
    })
    const muhendisSayisi = muhendisler.length
    const muhendisOrani = toplamCalisan > 0 ? +(muhendisSayisi / toplamCalisan * 100).toFixed(1) : 0

    // Muhendislerin ortalama calisma suresi
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

    // ARGE calisan orani
    const argeCalisanlar = personnel.filter(p => {
      const bolum = (p.bolum || '').toUpperCase()
      const bolumDetay = (p.bolumDetay || '').toUpperCase()
      return bolum.includes('M\u00dcHEND\u0130S') || bolum.includes('MUHENDIS') ||
        bolumDetay.includes('ARGE') || bolumDetay.includes('AR-GE')
    })
    const argeCalisanOrani = toplamCalisan > 0 ? +(argeCalisanlar.length / toplamCalisan * 100).toFixed(1) : 0

    // Yuksek Lisans mezun orani
    const yuksekLisansMezunlar = personnel.filter(p => {
      const tip = (p.egitimTipi || '').toUpperCase()
      return tip.includes('Y.L') || tip.includes('Y\u00dcKSEK L\u0130SANS') ||
        tip.includes('MASTER') || tip.includes('DOKTORA') || tip.includes('L\u0130SANS')
    })
    const yulesekLisansMezunOrani = toplamCalisan > 0 ? +(yuksekLisansMezunlar.length / toplamCalisan * 100).toFixed(1) : 0

    const kadinErkekOrani = toplamCalisan > 0 ? +(kadin / toplamCalisan * 100).toFixed(1) : 0
    const beyazMaviOrani = toplamCalisan > 0 ? +(beyazYaka / toplamCalisan * 100).toFixed(1) : 0

    // Asansor/Mekanik dagilimi
    const asansorSayisi = personnel.filter(p => p.asansorMekanik === 'ASANSOR').length
    const mekanikSayisi = personnel.filter(p => p.asansorMekanik === 'MEKANIK').length
    const yokSayisi = personnel.filter(p => p.asansorMekanik === 'YOK' || !p.asansorMekanik).length

    // Asansor ozel grubu
    const asansorPersonel = personnel.filter(p =>
      (p.bolum || '').toUpperCase().includes('ASANS\u00d6R') ||
      (p.bolum || '').toUpperCase().includes('ASANSOR')
    )
    const asansorMavi = asansorPersonel.filter(p => p.yakaRengi === 'MAVI').length
    const asansorBeyaz = asansorPersonel.filter(p => p.yakaRengi === 'BEYAZ').length

    return NextResponse.json({
      ozet: { toplamCalisan, beyazYaka, maviYaka, direkt, endirekt },
      cinsiyetDagilimi: { erkek, kadin },
      yakaCinsiyetTablosu,
      beyazYakaBolumler,
      maviYakaBolumler,
      direktBolumler: Object.entries(direktBolumler)
        .sort((a, b) => b[1] - a[1])
        .map(([bolum, sayi]) => ({ bolum, sayi, oran: direkt > 0 ? +(sayi / direkt * 100).toFixed(1) : 0 })),
      endirektBolumler: Object.entries(endirektBolumler)
        .sort((a, b) => b[1] - a[1])
        .map(([bolum, sayi]) => ({ bolum, sayi, oran: endirekt > 0 ? +(sayi / endirekt * 100).toFixed(1) : 0 })),
      istatistik: {
        kadinErkekOrani,
        beyazMaviOrani,
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
    })
  } catch (error) {
    console.error('Rapor verisi al\u0131n\u0131rken hata:', error)
    return NextResponse.json({ error: 'Rapor verisi al\u0131n\u0131rken bir hata olu\u015ftu' }, { status: 500 })
  }
}
