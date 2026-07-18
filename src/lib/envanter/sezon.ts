import { prisma } from '@/lib/prisma'
import { createTalep } from './satinalma'

export type SezonTipiTip = 'YAZLIK' | 'KISLIK'

type CreateSezonPlanKalemGirdi = {
  urunId: string
  kisiBasiAdet?: number
}

export type CreateSezonPlanInput = {
  ad: string
  sezonTipi: SezonTipiTip
  yil: number
  dagitimTarihi?: Date
  siparisKilitTarihi?: Date
  not?: string
  planlananAlim?: number | null
  turnoverOrani?: number | null
  emniyetPayiOrani?: number | null
  kalemler?: CreateSezonPlanKalemGirdi[]
}

export type UpdateSezonPlanOverrideInput = {
  planlananAlim?: number | null
  turnoverOrani?: number | null
  emniyetPayiOrani?: number | null
}

function upper(v: string) {
  return v.trim().toLocaleUpperCase('tr-TR')
}

export async function createSezonPlan(input: CreateSezonPlanInput) {
  if (!input.ad?.trim()) {
    throw new Error('Sezon planı adı zorunludur.')
  }
  if (!Number.isFinite(input.yil)) {
    throw new Error('Yıl zorunludur.')
  }

  return prisma.envanterSezonPlan.create({
    data: {
      ad: input.ad.trim(),
      sezonTipi: input.sezonTipi as never,
      yil: input.yil,
      dagitimTarihi: input.dagitimTarihi ?? null,
      siparisKilitTarihi: input.siparisKilitTarihi ?? null,
      not: input.not || null,
      planlananAlim: input.planlananAlim ?? null,
      turnoverOrani: input.turnoverOrani ?? null,
      emniyetPayiOrani: input.emniyetPayiOrani ?? null,
      kalemler:
        input.kalemler && input.kalemler.length > 0
          ? {
              create: input.kalemler.map((kalem) => ({
                urunId: kalem.urunId,
                kisiBasiAdet: kalem.kisiBasiAdet ?? 1,
              })),
            }
          : undefined,
    },
    include: { kalemler: true },
  })
}

export async function updateSezonPlanOverride(planId: string, input: UpdateSezonPlanOverrideInput) {
  const plan = await prisma.envanterSezonPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    throw new Error('Sezon planı bulunamadı.')
  }

  return prisma.envanterSezonPlan.update({
    where: { id: planId },
    data: {
      planlananAlim: input.planlananAlim === undefined ? undefined : input.planlananAlim,
      turnoverOrani: input.turnoverOrani === undefined ? undefined : input.turnoverOrani,
      emniyetPayiOrani: input.emniyetPayiOrani === undefined ? undefined : input.emniyetPayiOrani,
    },
  })
}

export async function listSezonPlan() {
  return prisma.envanterSezonPlan.findMany({
    include: { kalemler: true },
    orderBy: [{ yil: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getSezonPlanDetay(planId: string) {
  return prisma.envanterSezonPlan.findUnique({
    where: { id: planId },
    include: {
      kalemler: {
        include: {
          urun: { select: { kod: true, ad: true, kategori: true, varyantTipi: true, bedenTipi: true } },
        },
      },
    },
  })
}

export async function addSezonKalem(planId: string, urunId: string, kisiBasiAdet: number) {
  if (!urunId) {
    throw new Error('Ürün seçilmelidir.')
  }
  if (!Number.isFinite(kisiBasiAdet) || kisiBasiAdet < 1) {
    throw new Error('Kişi başı adet en az 1 olmalıdır.')
  }

  const plan = await prisma.envanterSezonPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    throw new Error('Sezon planı bulunamadı.')
  }

  return prisma.envanterSezonKalem.create({
    data: { planId, urunId, kisiBasiAdet },
    include: { urun: { select: { kod: true, ad: true, kategori: true, varyantTipi: true, bedenTipi: true } } },
  })
}

// ============================================================
// Sezon planlama parametreleri (kurum geneli varsayılan — singleton)
// ============================================================

export type SezonParametre = {
  id: string
  turnoverOrani: number
  emniyetPayiOrani: number
  turnoverKaynak: string
  not: string | null
  updatedById: string | null
  updatedAt: Date
}

const VARSAYILAN_PARAMETRE: SezonParametre = {
  id: 'default',
  turnoverOrani: 0,
  emniyetPayiOrani: 0,
  turnoverKaynak: 'MANUEL',
  not: null,
  updatedById: null,
  updatedAt: new Date(0),
}

export async function getSezonParametre(): Promise<SezonParametre> {
  const parametre = await prisma.envanterSezonParametre.findUnique({ where: { id: 'default' } })
  return parametre ?? VARSAYILAN_PARAMETRE
}

export type UpdateSezonParametreInput = {
  turnoverOrani: number
  emniyetPayiOrani: number
  turnoverKaynak?: string
  not?: string | null
  updatedById?: string | null
}

export async function updateSezonParametre(input: UpdateSezonParametreInput) {
  if (!Number.isFinite(input.turnoverOrani) || input.turnoverOrani < 0) {
    throw new Error('Turnover oranı geçerli bir sayı olmalıdır.')
  }
  if (!Number.isFinite(input.emniyetPayiOrani) || input.emniyetPayiOrani < 0) {
    throw new Error('Emniyet payı oranı geçerli bir sayı olmalıdır.')
  }

  const veri = {
    turnoverOrani: input.turnoverOrani,
    emniyetPayiOrani: input.emniyetPayiOrani,
    turnoverKaynak: input.turnoverKaynak ?? 'MANUEL',
    not: input.not ?? null,
    updatedById: input.updatedById ?? null,
  }

  return prisma.envanterSezonParametre.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...veri },
    update: veri,
  })
}

// ============================================================
// Öneri motoru — sadece OKUMA
// ============================================================

export type PlanlananAlimOnerisi = {
  value: number
  yok: boolean
}

// Açık kadro = PersonnelRequest status IN (APPROVED, IN_PROGRESS) (Açık Kadro Takibi — henüz KAPANDI değil).
// Sadece okuma; işe alım modülüne yazma yapılmaz.
export async function oneriPlanlananAlim(): Promise<PlanlananAlimOnerisi> {
  const sonuc = await prisma.personnelRequest.aggregate({
    where: { status: { in: ['APPROVED', 'IN_PROGRESS'] } },
    _sum: { headcount: true },
  })

  const toplam = sonuc._sum.headcount ?? 0

  return { value: toplam, yok: toplam === 0 }
}

export type TurnoverOranOnerisi = {
  value: number
  ayrilanSayisi: number
  ortalamaHeadcount: number
  ortalamaYaklasik: boolean
}

// Turnover = son 12 ayda ayrılan / ortalama headcount (dönem başı + dönem sonu / 2).
// Dönem başı headcount, geriye doğru: şimdiki aktif + son12ay ayrılan - son12ay giren.
// Sadece okuma; Personnel'e yazma yapılmaz.
export async function oneriTurnoverOrani(): Promise<TurnoverOranOnerisi> {
  const simdi = new Date()
  const oncekiYil = new Date(simdi)
  oncekiYil.setFullYear(oncekiYil.getFullYear() - 1)

  const [simdikiAktif, son12AyAyrilan, son12AyGiren] = await Promise.all([
    prisma.personnel.count({ where: { aktif: true } }),
    prisma.employmentPeriod.count({ where: { cikisTarihi: { gte: oncekiYil } } }),
    prisma.personnel.count({ where: { iseGirisTarihi: { gte: oncekiYil } } }),
  ])

  const onceki12AyHeadcount = simdikiAktif + son12AyAyrilan - son12AyGiren

  let ortalamaHeadcount = (onceki12AyHeadcount + simdikiAktif) / 2
  let ortalamaYaklasik = false

  if (ortalamaHeadcount <= 0) {
    ortalamaHeadcount = simdikiAktif
    ortalamaYaklasik = true
  }

  const oran = ortalamaHeadcount > 0 ? (son12AyAyrilan / ortalamaHeadcount) * 100 : 0

  return {
    value: Math.round(oran * 10) / 10,
    ayrilanSayisi: son12AyAyrilan,
    ortalamaHeadcount: Math.round(ortalamaHeadcount * 10) / 10,
    ortalamaYaklasik,
  }
}

// ============================================================
// İhtiyaç hesabı
// ============================================================

export type IhtiyacSatiri = {
  urunId: string
  urunKod: string
  urunAd: string
  beden: string | null
  mevcutPersonelSayisi: number
  yeniAlimSayisi: number
  turnoverSayisi: number
  bazIhtiyac: number
  emniyetAdet: number
  toplamIhtiyac: number
  mevcutStok: number
  netEksik: number
  bedenBilinmeyenSayisi: number
}

export type IhtiyacOzet = {
  bazPersonel: number
  planlananAlim: number
  turnoverOrani: number
  turnoverKisi: number
  emniyetOrani: number
  kaynak: {
    planlananAlim: 'PLAN' | 'ONERI'
    turnoverOrani: 'PLAN' | 'VARSAYILAN'
    emniyetPayiOrani: 'PLAN' | 'VARSAYILAN'
  }
}

export type HesaplaIhtiyacSonuc = {
  satirlar: IhtiyacSatiri[]
  ozet: IhtiyacOzet
}

// Ürünün bedenTipi alanı hangi personel beden profili alanıyla eşleştiğini
// doğrudan belirtir (artık kategori adından tahmin YOK).
function profilAlaniSec(
  bedenTipi: string,
): 'ustBeden' | 'altBeden' | 'ayakkabiNo' | 'eldivenNo' | null {
  if (bedenTipi === 'UST') return 'ustBeden'
  if (bedenTipi === 'ALT') return 'altBeden'
  if (bedenTipi === 'AYAKKABI') return 'ayakkabiNo'
  if (bedenTipi === 'ELDIVEN') return 'eldivenNo'
  return null
}

// Ek kişi sayısını (yeni alım veya turnover) mevcut beden dağılımına orantılı dağıtır.
// Taban paylar floor ile hesaplanır, kalan artık kişi en büyük gruba eklenir —
// böylece toplam her zaman tam olarak `ek` sayısına eşit kalır.
function dagitOrantili(gruplar: { sayi: number }[], ek: number): number[] {
  if (gruplar.length === 0) return []

  const toplamBaz = gruplar.reduce((t, g) => t + g.sayi, 0)

  if (ek === 0) {
    return gruplar.map(() => 0)
  }

  if (toplamBaz === 0) {
    // Dağıtım için baz yok (ör. bu bedende hiç personel yok) — ek kişi en büyük
    // (ilk) gruba yazılır; anlamlı bir oran hesaplanamaz.
    return gruplar.map((_, i) => (i === 0 ? ek : 0))
  }

  const tabanlar = gruplar.map((g) => Math.floor((g.sayi / toplamBaz) * ek))
  const kalan = ek - tabanlar.reduce((t, v) => t + v, 0)

  let maxIdx = 0
  for (let i = 1; i < gruplar.length; i++) {
    if (gruplar[i].sayi > gruplar[maxIdx].sayi) maxIdx = i
  }
  tabanlar[maxIdx] += kalan

  return tabanlar
}

export async function hesaplaIhtiyac(planId: string): Promise<HesaplaIhtiyacSonuc> {
  const plan = await prisma.envanterSezonPlan.findUnique({
    where: { id: planId },
    include: {
      kalemler: {
        include: {
          urun: {
            include: { varyantlar: true, stoklar: true },
          },
        },
      },
    },
  })

  if (!plan) {
    throw new Error('Sezon planı bulunamadı.')
  }

  const [parametre, aktifPersoneller, bedenProfilleri] = await Promise.all([
    getSezonParametre(),
    prisma.personnel.findMany({ where: { aktif: true }, select: { id: true } }),
    prisma.envanterPersonelBedenProfili.findMany(),
  ])

  const profilByPersonnelId = new Map(bedenProfilleri.map((p) => [p.personnelId, p]))
  const bazPersonel = aktifPersoneller.length

  let planlananAlim: number
  let planlananAlimKaynak: IhtiyacOzet['kaynak']['planlananAlim']

  if (plan.planlananAlim != null) {
    planlananAlim = plan.planlananAlim
    planlananAlimKaynak = 'PLAN'
  } else {
    const oneri = await oneriPlanlananAlim()
    planlananAlim = oneri.value
    planlananAlimKaynak = 'ONERI'
  }

  const turnoverOrani = plan.turnoverOrani ?? parametre.turnoverOrani
  const turnoverKaynak: IhtiyacOzet['kaynak']['turnoverOrani'] =
    plan.turnoverOrani != null ? 'PLAN' : 'VARSAYILAN'

  const emniyetOrani = plan.emniyetPayiOrani ?? parametre.emniyetPayiOrani
  const emniyetKaynak: IhtiyacOzet['kaynak']['emniyetPayiOrani'] =
    plan.emniyetPayiOrani != null ? 'PLAN' : 'VARSAYILAN'

  const turnoverKisi = Math.ceil((bazPersonel * turnoverOrani) / 100)

  const satirlar: IhtiyacSatiri[] = []

  for (const kalem of plan.kalemler) {
    const urun = kalem.urun
    const alan = profilAlaniSec(urun.bedenTipi)

    if (alan === null) {
      // bedenTipi=YOK → beden kırılımı yapılmaz, düz kişi sayısı × kişiBaşı adet.
      const bazIhtiyac = (bazPersonel + planlananAlim + turnoverKisi) * kalem.kisiBasiAdet
      const emniyetAdet = Math.ceil((bazIhtiyac * emniyetOrani) / 100)
      const toplamIhtiyac = bazIhtiyac + emniyetAdet
      const mevcutStok = urun.stoklar.reduce((toplam, stok) => toplam + stok.mevcut, 0)

      satirlar.push({
        urunId: urun.id,
        urunKod: urun.kod,
        urunAd: urun.ad,
        beden: null,
        mevcutPersonelSayisi: bazPersonel,
        yeniAlimSayisi: planlananAlim,
        turnoverSayisi: turnoverKisi,
        bazIhtiyac,
        emniyetAdet,
        toplamIhtiyac,
        mevcutStok,
        netEksik: Math.max(0, toplamIhtiyac - mevcutStok),
        bedenBilinmeyenSayisi: 0,
      })
      continue
    }

    const numaraTipi = urun.varyantTipi === 'NUMARA' || urun.varyantTipi === 'NUMARA_RENK'
    const varyantAlanAdi: 'beden' | 'numara' = numaraTipi ? 'numara' : 'beden'

    const bedenSayaci = new Map<string, number>()
    let bedenBilinmeyenSayisi = 0

    for (const personel of aktifPersoneller) {
      const profil = profilByPersonnelId.get(personel.id)
      const deger = (profil?.[alan] ?? '').trim()

      if (!deger) {
        bedenBilinmeyenSayisi++
        continue
      }

      bedenSayaci.set(deger, (bedenSayaci.get(deger) ?? 0) + 1)
    }

    const gruplar: { beden: string | null; sayi: number }[] = Array.from(
      bedenSayaci.entries(),
    ).map(([beden, sayi]) => ({ beden, sayi }))

    if (bedenBilinmeyenSayisi > 0 || gruplar.length === 0) {
      gruplar.push({ beden: null, sayi: bedenBilinmeyenSayisi })
    }

    const yeniAlimDagitim = dagitOrantili(gruplar, planlananAlim)
    const turnoverDagitim = dagitOrantili(gruplar, turnoverKisi)

    gruplar.forEach((grup, i) => {
      const yeniAlimSayisi = yeniAlimDagitim[i]
      const turnoverSayisi = turnoverDagitim[i]
      const toplamKisi = grup.sayi + yeniAlimSayisi + turnoverSayisi
      const bazIhtiyac = toplamKisi * kalem.kisiBasiAdet
      const emniyetAdet = Math.ceil((bazIhtiyac * emniyetOrani) / 100)
      const toplamIhtiyac = bazIhtiyac + emniyetAdet

      if (grup.beden === null) {
        satirlar.push({
          urunId: urun.id,
          urunKod: urun.kod,
          urunAd: urun.ad,
          beden: 'BİLİNMİYOR',
          mevcutPersonelSayisi: grup.sayi,
          yeniAlimSayisi,
          turnoverSayisi,
          bazIhtiyac,
          emniyetAdet,
          toplamIhtiyac,
          mevcutStok: 0,
          netEksik: toplamIhtiyac,
          bedenBilinmeyenSayisi: grup.sayi,
        })
        return
      }

      const varyant = urun.varyantlar.find(
        (v) => upper(v[varyantAlanAdi] ?? '') === upper(grup.beden as string),
      )

      const mevcutStok = varyant
        ? urun.stoklar
            .filter((stok) => stok.varyantId === varyant.id)
            .reduce((toplam, stok) => toplam + stok.mevcut, 0)
        : 0

      satirlar.push({
        urunId: urun.id,
        urunKod: urun.kod,
        urunAd: urun.ad,
        beden: grup.beden,
        mevcutPersonelSayisi: grup.sayi,
        yeniAlimSayisi,
        turnoverSayisi,
        bazIhtiyac,
        emniyetAdet,
        toplamIhtiyac,
        mevcutStok,
        netEksik: Math.max(0, toplamIhtiyac - mevcutStok),
        bedenBilinmeyenSayisi: 0,
      })
    })
  }

  return {
    satirlar,
    ozet: {
      bazPersonel,
      planlananAlim,
      turnoverOrani,
      turnoverKisi,
      emniyetOrani,
      kaynak: {
        planlananAlim: planlananAlimKaynak,
        turnoverOrani: turnoverKaynak,
        emniyetPayiOrani: emniyetKaynak,
      },
    },
  }
}

export async function olusturSatinAlmaTalebiFromPlan(
  planId: string,
  talepEden: { id?: string; ad: string },
) {
  const plan = await prisma.envanterSezonPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    throw new Error('Sezon planı bulunamadı.')
  }

  const { satirlar } = await hesaplaIhtiyac(planId)
  const eksikSatirlar = satirlar.filter((satir) => satir.netEksik > 0)

  if (eksikSatirlar.length === 0) {
    throw new Error('Net eksiği olan kalem yok; satın alma talebi oluşturulmadı.')
  }

  return createTalep({
    talepEdenId: talepEden.id,
    talepEdenAd: talepEden.ad,
    aciklama: `Sezon planı: ${plan.ad} (${plan.sezonTipi} ${plan.yil}) — otomatik ihtiyaç talebi.`,
    kalemler: eksikSatirlar.map((satir) => ({
      urunId: satir.urunId,
      malzemeKodu: satir.urunKod,
      malzemeAdi: satir.beden ? `${satir.urunAd} — Beden: ${satir.beden}` : satir.urunAd,
      talepMiktar: satir.netEksik,
      aciklama: `Sezon planı ${plan.ad}${satir.beden ? ' / Beden: ' + satir.beden : ''} kaynaklı otomatik talep.`,
    })),
  })
}
