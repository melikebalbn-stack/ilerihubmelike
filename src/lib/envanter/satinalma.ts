import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { createEnvanterStokHareket } from './service'

export type SatinAlmaDurumTip =
  | 'TASLAK'
  | 'IDARI_ISLER_ONAYI'
  | 'MUDUR_YRD_ONAYI'
  | 'MUDUR_ONAYI'
  | 'SATINALMA_ONAYI'
  | 'SIPARIS_ACILDI'
  | 'TERMIN_GIRILDI'
  | 'TESLIM_ALINDI'
  | 'STOGA_ISLENDI'
  | 'REDDEDILDI'
  | 'IPTAL'

export type SatinAlmaAksiyonTip = 'ONAYLA' | 'REDDET' | 'REVIZE'

export type Yapan = { id?: string | null; ad: string }

const DURUM_ETIKETLERI: Record<SatinAlmaDurumTip, string> = {
  TASLAK: 'Taslak',
  IDARI_ISLER_ONAYI: 'İdari İşler Onayı Bekliyor',
  MUDUR_YRD_ONAYI: 'Müdür Yrd. Onayı Bekliyor',
  MUDUR_ONAYI: 'Müdür Onayı Bekliyor',
  SATINALMA_ONAYI: 'Satınalma Onayı Bekliyor',
  SIPARIS_ACILDI: 'Sipariş Açıldı',
  TERMIN_GIRILDI: 'Termin Girildi',
  TESLIM_ALINDI: 'Teslim Alındı',
  STOGA_ISLENDI: 'Stoğa İşlendi',
  REDDEDILDI: 'Reddedildi',
  IPTAL: 'İptal',
}

// Onay zinciri — ONAYLA aksiyonu bu diziyi bir adım ilerletir. Zincir dışındaki
// (TERMIN_GIRILDI ve sonrası, REDDEDILDI, IPTAL) durumlar ayrı fonksiyonlarla yönetilir.
const ONAY_ZINCIRI: SatinAlmaDurumTip[] = [
  'TASLAK',
  'IDARI_ISLER_ONAYI',
  'MUDUR_YRD_ONAYI',
  'MUDUR_ONAYI',
  'SATINALMA_ONAYI',
  'SIPARIS_ACILDI',
]

const TERMINAL_DURUMLAR = new Set<SatinAlmaDurumTip>(['REDDEDILDI', 'IPTAL', 'STOGA_ISLENDI'])

type TalepKalemGirdi = {
  urunId?: string
  malzemeKodu?: string
  malzemeAdi: string
  talepMiktar: number
  aciklama?: string
}

export type CreateTalepInput = {
  talepEdenId?: string
  talepEdenAd: string
  bolum?: string
  masrafYeri?: string
  asansorMekanik?: string
  aciklama?: string
  kalemler: TalepKalemGirdi[]
}

async function generateFormNoTx(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const yil = new Date().getFullYear()
  const onEk = `MTF-${yil}-`

  const sonKayit = await tx.envanterSatinAlmaTalep.findFirst({
    where: { formNo: { startsWith: onEk } },
    orderBy: { formNo: 'desc' },
  })

  let sonSira = 0
  if (sonKayit) {
    const sayi = Number(sonKayit.formNo.slice(onEk.length))
    if (Number.isFinite(sayi)) sonSira = sayi
  }

  return `${onEk}${String(sonSira + 1).padStart(4, '0')}`
}

export async function generateFormNo(): Promise<string> {
  return prisma.$transaction((tx) => generateFormNoTx(tx))
}

// Bildirimleri asıl iş akışının transaction'ından bağımsız (best-effort) gönderir —
// bir bildirim/mail hatası onay/teslim işlemini bozmamalı.
async function bildirGecis(talep: {
  id: string
  formNo: string
  durum: SatinAlmaDurumTip
  talepEdenId: string | null
  talepEdenAd: string
}) {
  try {
    const adminlerSorgusu = TERMINAL_DURUMLAR.has(talep.durum)
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { isActive: true, role: { in: ['SUPER_ADMIN', 'ADMIN'] as never } },
          select: { id: true, email: true, name: true },
        })

    const talepSahibiSorgusu = talep.talepEdenId
      ? prisma.user.findUnique({
          where: { id: talep.talepEdenId },
          select: { id: true, email: true, name: true },
        })
      : Promise.resolve(null)

    const [adminler, talepSahibi] = await Promise.all([adminlerSorgusu, talepSahibiSorgusu])

    const hedefler = new Map<string, { id: string; email: string; name: string }>()
    for (const admin of adminler) {
      hedefler.set(admin.id, { id: admin.id, email: admin.email, name: admin.name || admin.email })
    }
    if (talepSahibi) {
      hedefler.set(talepSahibi.id, {
        id: talepSahibi.id,
        email: talepSahibi.email,
        name: talepSahibi.name || talepSahibi.email,
      })
    }

    if (hedefler.size === 0) return

    const durumEtiketi = DURUM_ETIKETLERI[talep.durum] ?? talep.durum
    const baslik = `Satın Alma Talebi ${talep.formNo}`
    const mesaj = `${talep.formNo} numaralı talep "${durumEtiketi}" aşamasına geçti.`
    const link = `/envanter?tab=satin-alma&talep=${talep.id}`

    await Promise.allSettled(
      Array.from(hedefler.values()).map((hedef) =>
        prisma.notification.create({
          data: { userId: hedef.id, title: baslik, message: mesaj, type: 'INFO', link },
        }),
      ),
    )

    if (process.env.ENVANTER_MAIL_AKTIF === 'true') {
      try {
        await sendEmail(
          Array.from(hedefler.values()).map((h) => ({ email: h.email, name: h.name })),
          baslik,
          mesaj,
        )
      } catch (err) {
        console.error('[satinalma] mail gönderme hatası:', err)
      }
    }
  } catch (err) {
    console.error('[satinalma] bildirim gönderme hatası:', err)
  }
}

export async function createTalep(input: CreateTalepInput) {
  if (!input.talepEdenAd?.trim()) {
    throw new Error('Talep eden adı zorunludur.')
  }
  if (!input.kalemler || input.kalemler.length === 0) {
    throw new Error('En az bir kalem eklenmelidir.')
  }
  for (const kalem of input.kalemler) {
    if (!kalem.malzemeAdi?.trim()) {
      throw new Error('Her kalem için malzeme adı zorunludur.')
    }
    if (!Number.isFinite(kalem.talepMiktar) || kalem.talepMiktar < 1) {
      throw new Error(`"${kalem.malzemeAdi}" için talep miktarı en az 1 olmalıdır.`)
    }
  }

  // formNo çakışması (nadir eşzamanlılık durumu) için sınırlı yeniden deneme.
  let sonHata: unknown
  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const formNo = await generateFormNoTx(tx)

        return tx.envanterSatinAlmaTalep.create({
          data: {
            formNo,
            talepEdenId: input.talepEdenId || null,
            talepEdenAd: input.talepEdenAd.trim(),
            bolum: input.bolum || null,
            masrafYeri: input.masrafYeri || null,
            asansorMekanik: input.asansorMekanik || null,
            aciklama: input.aciklama || null,
            durum: 'TASLAK',
            kalemler: {
              create: input.kalemler.map((kalem) => ({
                urunId: kalem.urunId || null,
                malzemeKodu: kalem.malzemeKodu || null,
                malzemeAdi: kalem.malzemeAdi.trim(),
                talepMiktar: kalem.talepMiktar,
                aciklama: kalem.aciklama || null,
              })),
            },
            gecmis: {
              create: {
                durum: 'TASLAK',
                yapanId: input.talepEdenId || null,
                yapanAd: input.talepEdenAd.trim(),
                not: 'Talep oluşturuldu.',
              },
            },
          },
          include: { kalemler: true, gecmis: true },
        })
      })
    } catch (err) {
      sonHata = err
      const kod = (err as { code?: string } | null)?.code
      if (kod === 'P2002') continue
      throw err
    }
  }
  throw sonHata instanceof Error ? sonHata : new Error('Talep oluşturulamadı.')
}

export async function listTalepler(options?: { durum?: SatinAlmaDurumTip }) {
  return prisma.envanterSatinAlmaTalep.findMany({
    where: options?.durum ? { durum: options.durum as never } : undefined,
    include: { kalemler: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTalepDetay(talepId: string) {
  return prisma.envanterSatinAlmaTalep.findUnique({
    where: { id: talepId },
    include: {
      kalemler: true,
      gecmis: { orderBy: { createdAt: 'asc' } },
    },
  })
}

export async function onayAksiyon(
  talepId: string,
  aksiyon: SatinAlmaAksiyonTip,
  yapan: Yapan,
  opts?: {
    not?: string
    redSebebi?: string
    uygunMiktarlar?: Record<string, number>
    ilerlet?: boolean
  },
) {
  const guncelTalep = await prisma.$transaction(async (tx) => {
    const mevcut = await tx.envanterSatinAlmaTalep.findUnique({ where: { id: talepId } })
    if (!mevcut) {
      throw new Error('Talep bulunamadı.')
    }

    const zincirIndex = ONAY_ZINCIRI.indexOf(mevcut.durum as SatinAlmaDurumTip)
    const ilerletilebilir = zincirIndex >= 0 && zincirIndex < ONAY_ZINCIRI.length - 1

    if (aksiyon === 'ONAYLA') {
      if (!ilerletilebilir) {
        throw new Error('Bu talep onay zincirinde ilerletilemez (zaten sipariş açıldı veya son aşamada).')
      }

      const yeniDurum = ONAY_ZINCIRI[zincirIndex + 1]

      const guncel = await tx.envanterSatinAlmaTalep.update({
        where: { id: talepId },
        data: { durum: yeniDurum as never },
      })

      await tx.envanterSatinAlmaGecmis.create({
        data: {
          talepId,
          durum: yeniDurum as never,
          aksiyon: 'ONAYLA',
          yapanId: yapan.id || null,
          yapanAd: yapan.ad,
          not: opts?.not || null,
        },
      })

      return guncel
    }

    if (aksiyon === 'REDDET') {
      if (zincirIndex < 0) {
        throw new Error('Bu talep bu aşamada reddedilemez.')
      }

      const redSebebi = (opts?.redSebebi || opts?.not || '').trim()
      if (!redSebebi) {
        throw new Error('Red sebebi zorunludur.')
      }

      const guncel = await tx.envanterSatinAlmaTalep.update({
        where: { id: talepId },
        data: { durum: 'REDDEDILDI', redSebebi },
      })

      await tx.envanterSatinAlmaGecmis.create({
        data: {
          talepId,
          durum: 'REDDEDILDI',
          aksiyon: 'REDDET',
          yapanId: yapan.id || null,
          yapanAd: yapan.ad,
          not: redSebebi,
        },
      })

      return guncel
    }

    // REVIZE
    if (zincirIndex < 0) {
      throw new Error('Bu talep bu aşamada revize edilemez.')
    }

    if (opts?.uygunMiktarlar) {
      for (const [kalemId, uygunMiktar] of Object.entries(opts.uygunMiktarlar)) {
        if (!Number.isFinite(uygunMiktar) || uygunMiktar < 0) continue
        await tx.envanterSatinAlmaKalem.updateMany({
          where: { id: kalemId, talepId },
          data: { uygunMiktar },
        })
      }
    }

    let yeniDurum: SatinAlmaDurumTip = mevcut.durum as SatinAlmaDurumTip
    if (opts?.ilerlet && ilerletilebilir) {
      yeniDurum = ONAY_ZINCIRI[zincirIndex + 1]
      await tx.envanterSatinAlmaTalep.update({
        where: { id: talepId },
        data: { durum: yeniDurum as never },
      })
    }

    await tx.envanterSatinAlmaGecmis.create({
      data: {
        talepId,
        durum: yeniDurum as never,
        aksiyon: 'REVIZE',
        yapanId: yapan.id || null,
        yapanAd: yapan.ad,
        not: opts?.not || null,
      },
    })

    return tx.envanterSatinAlmaTalep.findUniqueOrThrow({ where: { id: talepId } })
  })

  await bildirGecis(guncelTalep as never)

  return guncelTalep
}

export async function terminGir(talepId: string, tarih: Date, yapan: Yapan) {
  const guncelTalep = await prisma.$transaction(async (tx) => {
    const mevcut = await tx.envanterSatinAlmaTalep.findUnique({ where: { id: talepId } })
    if (!mevcut) {
      throw new Error('Talep bulunamadı.')
    }
    if (mevcut.durum !== 'SIPARIS_ACILDI') {
      throw new Error('Termin tarihi sadece "Sipariş Açıldı" aşamasında girilebilir.')
    }

    const guncel = await tx.envanterSatinAlmaTalep.update({
      where: { id: talepId },
      data: { durum: 'TERMIN_GIRILDI', terminTarihi: tarih },
    })

    await tx.envanterSatinAlmaGecmis.create({
      data: {
        talepId,
        durum: 'TERMIN_GIRILDI',
        yapanId: yapan.id || null,
        yapanAd: yapan.ad,
        not: `Termin tarihi girildi: ${tarih.toLocaleDateString('tr-TR')}`,
      },
    })

    return guncel
  })

  await bildirGecis(guncelTalep as never)

  return guncelTalep
}

export type KalemTeslimGirdi = { kalemId: string; miktar: number }

export async function teslimAl(
  talepId: string,
  kalemTeslimler: KalemTeslimGirdi[],
  yapan: Yapan,
  not?: string,
) {
  const guncelTalep = await prisma.$transaction(async (tx) => {
    const mevcut = await tx.envanterSatinAlmaTalep.findUnique({
      where: { id: talepId },
      include: { kalemler: true },
    })
    if (!mevcut) {
      throw new Error('Talep bulunamadı.')
    }
    if (mevcut.durum !== 'TERMIN_GIRILDI') {
      throw new Error('Teslimat sadece "Termin Girildi" aşamasında alınabilir.')
    }

    for (const teslim of kalemTeslimler) {
      if (!Number.isFinite(teslim.miktar) || teslim.miktar <= 0) continue

      const kalem = mevcut.kalemler.find((k) => k.id === teslim.kalemId)
      if (!kalem) continue

      const hedef = kalem.uygunMiktar ?? kalem.talepMiktar
      const yeniTeslimAlinan = kalem.teslimAlinanMiktar + teslim.miktar

      if (yeniTeslimAlinan > hedef) {
        throw new Error(`"${kalem.malzemeAdi}" için teslim miktarı talep/uygun miktarı aşamaz.`)
      }

      await tx.envanterSatinAlmaKalem.update({
        where: { id: kalem.id },
        data: { teslimAlinanMiktar: yeniTeslimAlinan },
      })
    }

    const guncelKalemler = await tx.envanterSatinAlmaKalem.findMany({ where: { talepId } })
    const tumuTeslimEdildi = guncelKalemler.every(
      (kalem) => kalem.teslimAlinanMiktar >= (kalem.uygunMiktar ?? kalem.talepMiktar),
    )

    const yeniDurum: SatinAlmaDurumTip = tumuTeslimEdildi ? 'TESLIM_ALINDI' : 'TERMIN_GIRILDI'

    const guncel = await tx.envanterSatinAlmaTalep.update({
      where: { id: talepId },
      data: { durum: yeniDurum as never },
    })

    await tx.envanterSatinAlmaGecmis.create({
      data: {
        talepId,
        durum: yeniDurum as never,
        yapanId: yapan.id || null,
        yapanAd: yapan.ad,
        not: not || (tumuTeslimEdildi ? 'Tüm kalemler teslim alındı.' : 'Kısmi teslimat alındı.'),
      },
    })

    return guncel
  })

  await bildirGecis(guncelTalep as never)

  return guncelTalep
}

export async function stogaIsle(talepId: string, yapan: Yapan) {
  const talep = await prisma.envanterSatinAlmaTalep.findUnique({
    where: { id: talepId },
    include: { kalemler: true },
  })
  if (!talep) {
    throw new Error('Talep bulunamadı.')
  }
  if (talep.durum !== 'TESLIM_ALINDI') {
    throw new Error('Stoğa işleme sadece "Teslim Alındı" aşamasında yapılabilir.')
  }

  // NOT: createEnvanterStokHareket kendi içinde ayrı bir $transaction açıyor
  // (service.ts, değiştirilmedi); bu yüzden kalemler arası atomiklik yoktur —
  // her kalemin stok hareketi kendi başına commit edilir.
  for (const kalem of talep.kalemler) {
    if (!kalem.urunId || kalem.teslimAlinanMiktar <= 0) continue

    let stok = await prisma.envanterStok.findFirst({
      where: { urunId: kalem.urunId },
      orderBy: { createdAt: 'asc' },
    })

    if (!stok) {
      stok = await prisma.envanterStok.create({
        data: {
          urunId: kalem.urunId,
          varyantId: null,
          mevcut: 0,
          depo: 'IDARI_ISLER',
          raf: null,
          durum: 'EKSIK',
        },
      })
    }

    await createEnvanterStokHareket({
      stokId: stok.id,
      hareketTipi: 'GIRIS',
      miktar: kalem.teslimAlinanMiktar,
      aciklama: `Satın alma talebi ${talep.formNo} - stoğa işlendi.`,
    })
  }

  const guncel = await prisma.envanterSatinAlmaTalep.update({
    where: { id: talepId },
    data: { durum: 'STOGA_ISLENDI' },
  })

  await prisma.envanterSatinAlmaGecmis.create({
    data: {
      talepId,
      durum: 'STOGA_ISLENDI',
      yapanId: yapan.id || null,
      yapanAd: yapan.ad,
      not: 'Kalemler stoğa işlendi.',
    },
  })

  await bildirGecis(guncel as never)

  return guncel
}
