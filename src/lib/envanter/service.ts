import { prisma } from '@/lib/prisma'
import type { EnvanterUrunForm, EnvanterUrunListItem } from '@/types/envanter'
import { assertValidEnvanterUrunForm } from './validation'
import { buildVaryantList, normalizeVaryantTipi } from './variants'
import {
  buildStockCreateInputs,
  getOverallStockStatus,
  getTotalInitialStock,
} from './stock'

function toNullableInt(value: string) {
  if (!value || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function toNullableDecimal(value: string) {
  if (!value || value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalDate(value: string) {
  if (!value || value.trim() === '') return null

  const normalized = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T00:00:00`)
  }

  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)

  if (match) {
    const [, day, month, year] = match
    return new Date(`${year}-${month}-${day}T00:00:00`)
  }

  return null
}

function normalizeKategori(value: string) {
  return value && value.trim() !== '' ? value.trim() : null
}

function mapUrunToListItem(urun: {
  id: string
  kod: string
  ad: string
  kategori: string | null
  tip: string
  bedenTipi: string
  olcuBirimi: string
  durum: string
  varyantlar: { id: string }[]
  stoklar: {
    mevcut: number
    minStok: number | null
    kritikStok: number | null
    durum: string
  }[]
}): EnvanterUrunListItem {
  const mevcut = urun.stoklar.reduce((total, stok) => total + stok.mevcut, 0)

  const minDegerler = urun.stoklar
    .map((stok) => stok.minStok)
    .filter((value): value is number => typeof value === 'number')

  const kritikDegerler = urun.stoklar
    .map((stok) => stok.kritikStok)
    .filter((value): value is number => typeof value === 'number')

  const stokDurum = getOverallStockStatus(
    urun.stoklar.map((stok) => ({
      key: '',
      mevcut: stok.mevcut,
      minStok: stok.minStok,
      kritikStok: stok.kritikStok,
      maxStok: null,
      depo: null,
      raf: null,
      durum:
        stok.durum === 'KRITIK'
          ? 'KRITIK'
          : stok.durum === 'MINIMUM'
            ? 'MINIMUM'
            : stok.durum === 'NORMAL'
              ? 'NORMAL'
              : 'EKSIK',
    })),
  )

  return {
    id: urun.id,
    kod: urun.kod,
    ad: urun.ad,
    kategori: urun.kategori,
    tip: urun.tip,
    bedenTipi: urun.bedenTipi,
    olcuBirimi: urun.olcuBirimi,
    mevcut,
    min: minDegerler.length > 0 ? Math.min(...minDegerler) : 0,
    kritik: kritikDegerler.length > 0 ? Math.min(...kritikDegerler) : 0,
    durum: urun.durum === 'PASIF' ? 'PASIF' : stokDurum,
    varyantSayisi: urun.varyantlar.length,
  }
}

export async function listEnvanterUrunler(): Promise<EnvanterUrunListItem[]> {
  const urunler = await prisma.envanterUrun.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      varyantlar: {
        select: {
          id: true,
        },
      },
      stoklar: {
        select: {
          mevcut: true,
          minStok: true,
          kritikStok: true,
          durum: true,
        },
      },
    },
  })

  return urunler.map(mapUrunToListItem)
}

export async function createEnvanterUrun(form: EnvanterUrunForm) {
  assertValidEnvanterUrunForm(form)

  const varyantlar = buildVaryantList(form)
  const stoklar = buildStockCreateInputs(form)
  const toplamIlkGiris = getTotalInitialStock(form)

  return prisma.$transaction(async (tx) => {
    const urun = await tx.envanterUrun.create({
      data: {
        kod: form.kod.trim(),
        ad: form.ad.trim(),
        kategori: normalizeKategori(form.kategori),
        tip: form.tip as never,
        olcuBirimi: form.olcuBirimi || 'ADET',
        barkod: form.barkod || null,
        aciklama: form.aciklama || null,

        varyantTipi: normalizeVaryantTipi(form.varyantTipi) as never,
        bedenTipi: (form.bedenTipi || 'YOK') as never,

        tedarikci: form.tedarikci || null,
        marka: form.marka || null,
        model: form.model || null,
        sonAlisFiyati: toNullableDecimal(form.sonAlisFiyati),
        paraBirimi: form.paraBirimi || 'TRY',
        kdvOrani: toNullableInt(form.kdvOrani),
        minSiparisMiktari: toNullableInt(form.minSiparisMiktari),
        tedarikSuresiGun: toNullableInt(form.tedarikSuresiGun),

        dagitimSekli: form.dagitimSekli || null,
        periyot: form.periyot || null,
        kullanimOmruGun: toNullableInt(form.kullanimOmruGun),
        teslimYetkisi: form.teslimYetkisi || null,
        sureSonuAksiyonu: form.sureSonuAksiyonu || null,
        dagitimKurali: form.dagitimKurali || null,

        eskiUrunIade: form.eskiUrunIade,
        yoneticiOnayi: form.yoneticiOnayi,
        aciklamaZorunlu: form.aciklamaZorunlu,
        fotoZorunlu: form.fotoZorunlu,
        imzaZorunlu: form.imzaZorunlu,
        qrZorunlu: form.qrZorunlu,
        barkodZorunlu: form.barkodZorunlu,

        hedefYaka: form.hedefYaka || null,
        hedefBolum: form.hedefBolum || null,
        hedefPozisyon: form.hedefPozisyon || null,
        hedefLokasyon: form.hedefLokasyon || null,
        hedefVardiya: form.hedefVardiya || null,
        calismaSekli: form.calismaSekli || null,
        personelHedefTipi: form.personelHedefTipi || null,
        atamaTipi: form.atamaTipi || null,
        tahminiDagitim: form.tahminiDagitim || null,
        sonrakiDagitimTarihi: parseOptionalDate(form.sonrakiDagitimTarihi),
      },
    })

    if (varyantlar.length > 0) {
      await tx.envanterUrunVaryant.createMany({
        data: varyantlar.map((varyant) => ({
          urunId: urun.id,
          varyantAdi: varyant.varyantAdi,
          beden: varyant.beden ?? null,
          numara: varyant.numara ?? null,
          renk: varyant.renk ?? null,
        })),
      })
    }

    const savedVariants = await tx.envanterUrunVaryant.findMany({
      where: {
        urunId: urun.id,
      },
      select: {
        id: true,
        varyantAdi: true,
      },
    })

    const variantIdByName = new Map(
      savedVariants.map((variant) => [variant.varyantAdi, variant.id]),
    )

    await tx.envanterStok.createMany({
      data: stoklar.map((stok) => ({
        urunId: urun.id,
        varyantId: variantIdByName.get(stok.key) ?? null,
        mevcut: stok.mevcut,
        minStok: stok.minStok,
        kritikStok: stok.kritikStok,
        maxStok: stok.maxStok,
        depo: stok.depo,
        raf: stok.raf,
        durum: stok.durum,
      })),
    })

    const stokHareketleri = stoklar
      .filter((stok) => stok.mevcut > 0)
      .map((stok) => ({
        urunId: urun.id,
        varyantId: variantIdByName.get(stok.key) ?? null,
        hareketTipi: 'GIRIS' as const,
        miktar: stok.mevcut,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: 'Ürün kartı oluşturulurken ilk stok girişi.',
      }))

    if (stokHareketleri.length > 0) {
      await tx.envanterStokHareket.createMany({
        data: stokHareketleri,
      })
    }

    if (form.seciliPersoneller.length > 0) {
      await tx.envanterUrunPersonelHedef.createMany({
        data: form.seciliPersoneller.map((personnelId) => ({
          urunId: urun.id,
          personnelId,
        })),
        skipDuplicates: true,
      })
    }

    return {
      id: urun.id,
      kod: urun.kod,
      ad: urun.ad,
      toplamIlkGiris,
      varyantSayisi: varyantlar.length,
    }
  })
}

export async function getEnvanterUrunDetail(id: string) {
  const urun = await prisma.envanterUrun.findUnique({
    where: { id },
    include: {
      varyantlar: {
        orderBy: { varyantAdi: 'asc' },
        select: {
          id: true,
          varyantAdi: true,
          beden: true,
          numara: true,
          renk: true,
        },
      },
      stoklar: {
        orderBy: { createdAt: 'asc' },
        include: {
          varyant: {
            select: {
              varyantAdi: true,
            },
          },
        },
      },
      hareketler: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!urun) return null

  return {
    id: urun.id,
    kod: urun.kod,
    ad: urun.ad,
    kategori: urun.kategori,
    tip: urun.tip,
    olcuBirimi: urun.olcuBirimi,
    barkod: urun.barkod,
    aciklama: urun.aciklama,
    tedarikci: urun.tedarikci,
    marka: urun.marka,
    model: urun.model,
    dagitimSekli: urun.dagitimSekli,
    periyot: urun.periyot,
    kullanimOmruGun: urun.kullanimOmruGun,
    teslimYetkisi: urun.teslimYetkisi,
    sureSonuAksiyonu: urun.sureSonuAksiyonu,
    dagitimKurali: urun.dagitimKurali,
    createdAt: urun.createdAt.toISOString(),

    varyantlar: urun.varyantlar,

    stoklar: urun.stoklar.map((stok) => ({
      id: stok.id,
      mevcut: stok.mevcut,
      minStok: stok.minStok,
      kritikStok: stok.kritikStok,
      maxStok: stok.maxStok,
      depo: stok.depo,
      raf: stok.raf,
      durum: stok.durum,
      varyantAdi: stok.varyant?.varyantAdi ?? null,
    })),

    hareketler: urun.hareketler.map((hareket) => ({
      id: hareket.id,
      hareketTipi: hareket.hareketTipi,
      miktar: hareket.miktar,
      depo: hareket.depo,
      raf: hareket.raf,
      aciklama: hareket.aciklama,
      createdAt: hareket.createdAt.toISOString(),
    })),
  }
}

export async function createEnvanterStokHareket(input: {
  personnelId?: string
  stokId: string
  hareketTipi: 'GIRIS' | 'CIKIS' | 'ZIMMET' | 'IADE' | 'HURDA' | 'SAYIM_DUZELTME'
  miktar: number
  aciklama?: string
}) {
  if (!input.stokId) {
    throw new Error('Stok kaydı seçilmelidir.')
  }

  if (!Number.isFinite(input.miktar) || input.miktar < 0) {
    throw new Error('Miktar geçerli olmalıdır.')
  }

  return prisma.$transaction(async (tx) => {
    const stok = await tx.envanterStok.findUnique({
      where: { id: input.stokId },
    })

    if (!stok) {
      throw new Error('Stok kaydı bulunamadı.')
    }

    let yeniMevcut = stok.mevcut

    if (input.hareketTipi === 'GIRIS' || input.hareketTipi === 'IADE') {
      yeniMevcut = stok.mevcut + input.miktar
    }

    if (
      input.hareketTipi === 'CIKIS' ||
      input.hareketTipi === 'ZIMMET' ||
      input.hareketTipi === 'HURDA'
    ) {
      yeniMevcut = stok.mevcut - input.miktar
    }

    if (input.hareketTipi === 'SAYIM_DUZELTME') {
      yeniMevcut = input.miktar
    }

    if (yeniMevcut < 0) {
      throw new Error('Stok eksiye düşemez.')
    }

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'

    if (stok.minStok === null || stok.kritikStok === null) {
      durum = 'EKSIK'
    } else if (yeniMevcut <= stok.kritikStok) {
      durum = 'KRITIK'
    } else if (yeniMevcut <= stok.minStok) {
      durum = 'MINIMUM'
    }

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: {
        mevcut: yeniMevcut,
        durum,
      },
    })

    const hareket = await tx.envanterStokHareket.create({
      data: {
        personnelId: input.personnelId || null,
        urunId: stok.urunId,
        varyantId: stok.varyantId,
        hareketTipi: input.hareketTipi,
        miktar: input.miktar,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: input.aciklama || null,
      },
    })

    return {
      stok: updatedStok,
      hareket,
    }
  })
}

export async function createZimmet(input: {
  personnelId: string
  stokId: string
  miktar: number
  aciklama?: string
  createdById?: string
}) {
  if (!input.personnelId) {
    throw new Error('Personel seçilmelidir.')
  }
  if (!input.stokId) {
    throw new Error('Stok kaydı seçilmelidir.')
  }
  if (!Number.isFinite(input.miktar) || input.miktar < 1) {
    throw new Error('Miktar en az 1 olmalıdır.')
  }

  return prisma.$transaction(async (tx) => {
    const stok = await tx.envanterStok.findUnique({
      where: { id: input.stokId },
    })
    if (!stok) {
      throw new Error('Stok kaydı bulunamadı.')
    }

    const yeniMevcut = stok.mevcut - input.miktar
    if (yeniMevcut < 0) {
      throw new Error(`Yetersiz stok. Mevcut: ${stok.mevcut}, istenen: ${input.miktar}.`)
    }

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
    if (stok.minStok === null || stok.kritikStok === null) {
      durum = 'EKSIK'
    } else if (yeniMevcut <= stok.kritikStok) {
      durum = 'KRITIK'
    } else if (yeniMevcut <= stok.minStok) {
      durum = 'MINIMUM'
    }

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: { mevcut: yeniMevcut, durum },
    })

    const zimmet = await tx.envanterZimmet.create({
      data: {
        urunId: stok.urunId,
        stokId: stok.id,
        personnelId: input.personnelId,
        miktar: input.miktar,
        aciklama: input.aciklama || null,
        createdById: input.createdById || null,
      },
      include: {
        urun: { select: { kod: true, ad: true } },
        personnel: { select: { sicilNo: true, adSoyad: true } },
      },
    })

    const hareket = await tx.envanterStokHareket.create({
      data: {
        personnelId: input.personnelId,
        urunId: stok.urunId,
        varyantId: stok.varyantId,
        hareketTipi: 'ZIMMET',
        miktar: input.miktar,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: input.aciklama || null,
        createdById: input.createdById || null,
      },
    })

    return { zimmet, stok: updatedStok, hareket }
  })
}

export async function iadeZimmet(input: {
  zimmetId: string
  iadeMiktar: number
  aciklama?: string
  createdById?: string
}) {
  if (!input.zimmetId) {
    throw new Error('Zimmet kaydı seçilmelidir.')
  }
  if (!Number.isFinite(input.iadeMiktar) || input.iadeMiktar < 1) {
    throw new Error('İade miktarı en az 1 olmalıdır.')
  }

  return prisma.$transaction(async (tx) => {
    const zimmet = await tx.envanterZimmet.findUnique({
      where: { id: input.zimmetId },
    })
    if (!zimmet) {
      throw new Error('Zimmet kaydı bulunamadı.')
    }
    if (zimmet.durum !== 'AKTIF') {
      throw new Error('Bu zimmet aktif değil.')
    }
    if (input.iadeMiktar > zimmet.miktar) {
      throw new Error(`İade miktarı zimmet miktarını aşamaz. Zimmette: ${zimmet.miktar}.`)
    }

    const stok = await tx.envanterStok.findUnique({
      where: { id: zimmet.stokId },
    })
    if (!stok) {
      throw new Error('Stok kaydı bulunamadı.')
    }

    let guncelZimmet
    let yeniIadeZimmet = null

    if (input.iadeMiktar === zimmet.miktar) {
      guncelZimmet = await tx.envanterZimmet.update({
        where: { id: zimmet.id },
        data: {
          durum: 'IADE_EDILDI',
          iadeTarihi: new Date(),
          aciklama: input.aciklama
            ? `${zimmet.aciklama ? `${zimmet.aciklama} | ` : ''}İade: ${input.aciklama}`
            : zimmet.aciklama,
        },
      })
    } else {
      guncelZimmet = await tx.envanterZimmet.update({
        where: { id: zimmet.id },
        data: {
          miktar: zimmet.miktar - input.iadeMiktar,
        },
      })

      yeniIadeZimmet = await tx.envanterZimmet.create({
        data: {
          urunId: zimmet.urunId,
          stokId: zimmet.stokId,
          personnelId: zimmet.personnelId,
          miktar: input.iadeMiktar,
          durum: 'IADE_EDILDI',
          teslimTarihi: zimmet.teslimTarihi,
          iadeTarihi: new Date(),
          aciklama: input.aciklama || 'Kısmi iade',
          createdById: input.createdById || null,
        },
      })
    }

    const yeniMevcut = stok.mevcut + input.iadeMiktar

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
    if (stok.minStok === null || stok.kritikStok === null) {
      durum = 'EKSIK'
    } else if (yeniMevcut <= stok.kritikStok) {
      durum = 'KRITIK'
    } else if (yeniMevcut <= stok.minStok) {
      durum = 'MINIMUM'
    }

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: { mevcut: yeniMevcut, durum },
    })

    const hareket = await tx.envanterStokHareket.create({
      data: {
        personnelId: zimmet.personnelId,
        urunId: stok.urunId,
        varyantId: stok.varyantId,
        hareketTipi: 'IADE',
        miktar: input.iadeMiktar,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: input.aciklama || null,
        createdById: input.createdById || null,
      },
    })

    return {
      zimmet: yeniIadeZimmet ? [guncelZimmet, yeniIadeZimmet] : guncelZimmet,
      stok: updatedStok,
      hareket,
    }
  })
}