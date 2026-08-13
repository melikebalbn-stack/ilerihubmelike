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
  varyantTipi: string
  varyantlar: { id: string; beden?: string | null; numara?: string | null; renk?: string | null }[]
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
    varyantOzeti: buildVaryantOzeti(urun.varyantTipi, urun.varyantlar), // Faz 2
  }
}

// Faz 2 — varyantların beden/numara/renk değerlerinden kısa özet metni üretir.
function buildVaryantOzeti(
  varyantTipi: string,
  varyantlar: { beden?: string | null; numara?: string | null; renk?: string | null }[],
): string {
  if (!varyantlar || varyantlar.length === 0 || varyantTipi === 'YOK') return ''
  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter((x): x is string => Boolean(x))))
  const bedenler = uniq(varyantlar.map((v) => v.beden))
  const numaralar = uniq(varyantlar.map((v) => v.numara))
  const renkler = uniq(varyantlar.map((v) => v.renk))
  const parcalar: string[] = []
  if (bedenler.length) parcalar.push(`Beden: ${bedenler.join(', ')}`)
  if (numaralar.length) parcalar.push(`Numara: ${numaralar.join(', ')}`)
  if (renkler.length) parcalar.push(`Renk: ${renkler.join(', ')}`)
  return parcalar.join(' | ')
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
          beden: true, // Faz 2 — varyantOzeti için
          numara: true,
          renk: true,
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
              id: true,
              varyantAdi: true,
              aktif: true,
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
      varyantId: stok.varyant?.id ?? null,
      varyantAktif: stok.varyant?.aktif ?? true,
      birimMaliyet: stok.birimMaliyet, // Faz 2
      paraBirimi: stok.paraBirimi, // Faz 2
    })),

    hareketler: urun.hareketler.map((hareket) => ({
      id: hareket.id,
      hareketTipi: hareket.hareketTipi,
      miktar: hareket.miktar,
      depo: hareket.depo,
      raf: hareket.raf,
      aciklama: hareket.aciklama,
      createdAt: hareket.createdAt.toISOString(),
      bolum: hareket.bolum, // Faz 2 — sarf dağıtım bölümü
      alanPersonelAd: hareket.alanPersonelAd, // Faz 2 — alan personel
      geriAlindi: hareket.geriAlindi, // Faz 2 — geri alma
      hareketTipiRaw: hareket.hareketTipi, // Faz 2 — ham enum değeri
    })),
  }
}

export async function createEnvanterStokHareket(input: {
  personnelId?: string
  stokId: string
  hareketTipi: 'GIRIS' | 'CIKIS' | 'ZIMMET' | 'IADE' | 'HURDA' | 'SAYIM_DUZELTME'
  miktar: number
  aciklama?: string
  // Faz 2 — sarf/dağıtım alan personeli + bölüm (hepsi opsiyonel, additive)
  bolum?: string
  alanPersonelId?: string
  alanPersonelAd?: string
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
        // Faz 2 — sarf dağıtım alan personeli + bölüm
        bolum: input.bolum || null,
        alanPersonelId: input.alanPersonelId || null,
        alanPersonelAd: input.alanPersonelAd || null,
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
  // KKD grubu + verilme tarihi: teslim takip listesi (getTeslimListesi) bu iki
  // alandan besleniyor; yazılmazsa zimmet listede görünmez.
  kkdUstGrubu?: string
  kkdAltGrubu?: string
  verilmeTarihi?: Date
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
        kkdUstGrubu: input.kkdUstGrubu || null,
        kkdAltGrubu: input.kkdAltGrubu || null,
        verilmeTarihi: input.verilmeTarihi || null,
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
// ============ Faz 2 — yeni servis fonksiyonları ============

export async function geriAlStokHareket(hareketId: string) {
  const orijinal = await prisma.envanterStokHareket.findUnique({
    where: { id: hareketId },
  })

  if (!orijinal) {
    throw new Error('Hareket bulunamadı.')
  }
  if (orijinal.geriAlindi) {
    throw new Error('Bu hareket zaten geri alınmış.')
  }

  const tersTip: Record<string, 'GIRIS' | 'CIKIS' | 'IADE'> = {
    CIKIS: 'IADE',
    GIRIS: 'CIKIS',
    IADE: 'CIKIS',
    ZIMMET: 'IADE',
    HURDA: 'IADE',
  }

  const yeniTip = tersTip[orijinal.hareketTipi]
  if (!yeniTip) {
    throw new Error('Bu hareket tipi geri alınamaz (ör. sayım düzeltme).')
  }

  return prisma.$transaction(async (tx) => {
    // Orijinali işaretle
    await tx.envanterStokHareket.update({
      where: { id: orijinal.id },
      data: { geriAlindi: true },
    })

    // Ters hareketi oluştur (stok mevcut buna göre güncellenir)
    const stok = await tx.envanterStok.findFirst({
      where: { urunId: orijinal.urunId, varyantId: orijinal.varyantId },
    })
    if (!stok) throw new Error('Stok kaydı bulunamadı.')

    let yeniMevcut = stok.mevcut
    if (yeniTip === 'IADE') yeniMevcut = stok.mevcut + orijinal.miktar
    if (yeniTip === 'CIKIS') yeniMevcut = stok.mevcut - orijinal.miktar
    if (yeniMevcut < 0) throw new Error('Geri alma stoğu eksiye düşürüyor.')

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
    if (stok.minStok === null || stok.kritikStok === null) durum = 'EKSIK'
    else if (yeniMevcut <= stok.kritikStok) durum = 'KRITIK'
    else if (yeniMevcut <= stok.minStok) durum = 'MINIMUM'

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: { mevcut: yeniMevcut, durum },
    })

    const tersHareket = await tx.envanterStokHareket.create({
      data: {
        urunId: orijinal.urunId,
        varyantId: orijinal.varyantId,
        hareketTipi: yeniTip,
        miktar: orijinal.miktar,
        depo: orijinal.depo,
        raf: orijinal.raf,
        aciklama: `Geri alma: ${orijinal.hareketTipi} hareketi iptal edildi`,
        bolum: orijinal.bolum,
        alanPersonelId: orijinal.alanPersonelId,
        alanPersonelAd: orijinal.alanPersonelAd,
        geriAlindi: true,
      },
    })

    return { stok: updatedStok, tersHareket }
  })
}

export async function addVaryantToUrun(input: {
  urunId: string
  tip: 'BEDEN' | 'NUMARA' | 'RENK'
  deger: string
  depo?: string | null
}) {
  const deger = input.deger.trim()
  if (!deger) throw new Error('Varyant değeri boş olamaz.')

  return prisma.$transaction(async (tx) => {
    const urun = await tx.envanterUrun.findUnique({ where: { id: input.urunId } })
    if (!urun) throw new Error('Ürün bulunamadı.')

    // Mükerrer kontrol
    const mevcut = await tx.envanterUrunVaryant.findFirst({
      where: { urunId: input.urunId, varyantAdi: deger },
    })
    if (mevcut) throw new Error('Bu varyant zaten mevcut.')

    // Varyantı oluştur
    const varyant = await tx.envanterUrunVaryant.create({
      data: {
        urunId: input.urunId,
        varyantAdi: deger,
        beden: input.tip === 'BEDEN' ? deger : null,
        numara: input.tip === 'NUMARA' ? deger : null,
        renk: input.tip === 'RENK' ? deger : null,
      },
    })

    // Ürünün varyantTipi'sini güncelle (YOK -> ilk eklenen tip; 
    // farklı tip eklenirse karma tipe geç)
    const yeniTip =
      urun.varyantTipi === 'YOK'
        ? input.tip
        : urun.varyantTipi === input.tip
          ? input.tip
          : input.tip === 'RENK' || urun.varyantTipi === 'RENK'
            ? (urun.varyantTipi === 'BEDEN' || input.tip === 'BEDEN' ? 'BEDEN_RENK' : 'NUMARA_RENK')
            : urun.varyantTipi
    if (yeniTip !== urun.varyantTipi) {
      await tx.envanterUrun.update({
        where: { id: input.urunId },
        data: { varyantTipi: yeniTip as never },
      })
    }

    // Stok kaydı aç (mevcut 0)
    await tx.envanterStok.create({
      data: {
        urunId: input.urunId,
        varyantId: varyant.id,
        mevcut: 0,
        minStok: null,
        kritikStok: null,
        maxStok: null,
        depo: input.depo?.trim() || null,
        raf: null,
        durum: 'EKSIK',
      },
    })

    return { varyant }
  })
}

export async function updateStokEsik(input: {
  stokId: string
  minStok: number | null
  kritikStok: number | null
}) {
  const stok = await prisma.envanterStok.findUnique({ where: { id: input.stokId } })
  if (!stok) throw new Error('Stok kaydı bulunamadı.')

  // Durumu yeni eşiklere göre yeniden hesapla
  let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
  if (input.minStok === null || input.kritikStok === null) durum = 'EKSIK'
  else if (stok.mevcut <= input.kritikStok) durum = 'KRITIK'
  else if (stok.mevcut <= input.minStok) durum = 'MINIMUM'

  return prisma.envanterStok.update({
    where: { id: input.stokId },
    data: { minStok: input.minStok, kritikStok: input.kritikStok, durum },
  })
}

export async function updateStokMaliyet(input: {
  stokId: string
  birimMaliyet: number | null
  paraBirimi: string | null
}) {
  const stok = await prisma.envanterStok.findUnique({ where: { id: input.stokId } })
  if (!stok) throw new Error('Stok kaydı bulunamadı.')
  return prisma.envanterStok.update({
    where: { id: input.stokId },
    data: {
      birimMaliyet: input.birimMaliyet,
      paraBirimi: input.paraBirimi || 'TL',
    },
  })
}

export async function updateVaryant(input: {
  varyantId: string
  varyantAdi?: string
  beden?: string | null
  numara?: string | null
  renk?: string | null
}) {
  const varyant = await prisma.envanterUrunVaryant.findUnique({ where: { id: input.varyantId } })
  if (!varyant) throw new Error('Varyant bulunamadı.')

  const data: Record<string, unknown> = {}
  if (input.varyantAdi !== undefined && input.varyantAdi.trim()) {
    data.varyantAdi = input.varyantAdi.trim()
  }
  if (input.beden !== undefined) data.beden = input.beden
  if (input.numara !== undefined) data.numara = input.numara
  if (input.renk !== undefined) data.renk = input.renk

  if (Object.keys(data).length === 0) {
    throw new Error('Güncellenecek alan gönderilmedi.')
  }

  return prisma.envanterUrunVaryant.update({
    where: { id: input.varyantId },
    data,
  })
}

export async function deleteVaryant(varyantId: string) {
  const varyant = await prisma.envanterUrunVaryant.findUnique({
    where: { id: varyantId },
    include: { stoklar: { select: { id: true } } },
  })
  if (!varyant) throw new Error('Varyant bulunamadı.')
  if (!varyant.aktif) {
    return { pasifleştirildi: false, silindi: false, mesaj: 'Varyant zaten pasif.' }
  }

  const stokIdleri = varyant.stoklar.map((s) => s.id)

  const hareketSayisi = await prisma.envanterStokHareket.count({
    where: { varyantId },
  })

  const zimmetSayisi =
    stokIdleri.length > 0
      ? await prisma.envanterZimmet.count({
          where: { stokId: { in: stokIdleri } },
        })
      : 0

  if (hareketSayisi > 0 || zimmetSayisi > 0) {
    // Geçmişi var — hard-delete edilemez, pasifleştir.
    await prisma.envanterUrunVaryant.update({
      where: { id: varyantId },
      data: { aktif: false },
    })
    return {
      pasifleştirildi: true,
      silindi: false,
      mesaj: `Varyantın ${hareketSayisi} hareket ve ${zimmetSayisi} zimmet geçmişi var, bu yüzden pasifleştirildi (silinmedi).`,
    }
  }

  // Geçmişi yok — hard-delete (varyant + boş stok kayıtları).
  await prisma.$transaction([
    prisma.envanterStok.deleteMany({ where: { varyantId } }),
    prisma.envanterUrunVaryant.delete({ where: { id: varyantId } }),
  ])

  return { pasifleştirildi: false, silindi: true, mesaj: 'Varyant silindi.' }
}
