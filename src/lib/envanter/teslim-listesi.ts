import { prisma } from '@/lib/prisma'

export type TeslimHucre = { sonTarih: string | null; adet: number }

export type TeslimSatiri = {
  personnelId: string
  sicilNo: string | null
  adSoyad: string
  sinif: string | null
  bolum: string
  yakaRengi: string
  ustBeden: string | null
  altBeden: string | null
  ayakkabiNo: string | null
  eldivenNo: string | null
  hucreler: Record<string, TeslimHucre>
}

export type TeslimListesiSonuc = {
  gruplar: string[]
  bolumler: string[]
  grupPeriyotlari: Record<string, number | null>
  satirlar: TeslimSatiri[]
}

// NOT: Beden kaynağı burada EnvanterPersonelBedenProfili'dir.
// Canlıda beden Personnel kartında tutuluyorsa, bedenProfil map'ini
// Personnel alanlarından besleyecek şekilde SADECE bu fonksiyon değişir.
export async function getTeslimListesi(options?: { bolum?: string }): Promise<TeslimListesiSonuc> {
  const [personeller, zimmetler, bedenProfilleri, kategoriler] = await Promise.all([
    prisma.personnel.findMany({
      where: { aktif: true, ...(options?.bolum ? { bolum: options.bolum } : {}) },
      select: {
        id: true, sicilNo: true, adSoyad: true, sinif: true, bolum: true, yakaRengi: true,
      },
      orderBy: [{ bolum: 'asc' }, { adSoyad: 'asc' }],
    }),
    prisma.envanterZimmet.findMany({
      where: { kkdAltGrubu: { not: null } },
      select: {
        personnelId: true,
        kkdAltGrubu: true,
        miktar: true,
        verilmeTarihi: true,
        teslimTarihi: true,
      },
    }),
    prisma.envanterPersonelBedenProfili.findMany({
      select: {
        personnelId: true, ustBeden: true, altBeden: true, ayakkabiNo: true, eldivenNo: true,
      },
    }),
    prisma.envanterKategori.findMany({
      select: { ad: true, yenilemePeriyoduAy: true },
    }),
  ])

  const bedenMap = new Map(bedenProfilleri.map((b) => [b.personnelId, b]))
  const periyotMap = new Map(kategoriler.map((k) => [k.ad, k.yenilemePeriyoduAy]))

  // personnelId -> grup -> { sonTarih, adet }
  const zimmetMap = new Map<string, Map<string, { sonTarih: Date | null; adet: number }>>()
  const grupSet = new Set<string>()

  for (const z of zimmetler) {
    const grup = (z.kkdAltGrubu ?? '').trim()
    if (!grup) continue
    grupSet.add(grup)

    if (!zimmetMap.has(z.personnelId)) zimmetMap.set(z.personnelId, new Map())
    const grupMap = zimmetMap.get(z.personnelId)!

    const tarih = z.verilmeTarihi ?? z.teslimTarihi ?? null
    const mevcut = grupMap.get(grup)
    if (!mevcut) {
      grupMap.set(grup, { sonTarih: tarih, adet: 1 })
    } else {
      mevcut.adet += 1
      if (tarih && (!mevcut.sonTarih || tarih > mevcut.sonTarih)) mevcut.sonTarih = tarih
    }
  }

  const gruplar = Array.from(grupSet).sort((a, b) => a.localeCompare(b, 'tr'))
  const bolumSet = new Set<string>()

  const satirlar: TeslimSatiri[] = personeller.map((p) => {
    bolumSet.add(p.bolum)
    const beden = bedenMap.get(p.id)
    const grupMap = zimmetMap.get(p.id)
    const hucreler: Record<string, { sonTarih: string | null; adet: number }> = {}
    if (grupMap) {
      for (const [grup, v] of grupMap.entries()) {
        hucreler[grup] = {
          sonTarih: v.sonTarih ? v.sonTarih.toISOString().slice(0, 10) : null,
          adet: v.adet,
        }
      }
    }
    return {
      personnelId: p.id,
      sicilNo: p.sicilNo,
      adSoyad: p.adSoyad,
      sinif: p.sinif ?? null,
      bolum: p.bolum,
      yakaRengi: p.yakaRengi,
      ustBeden: beden?.ustBeden ?? null,
      altBeden: beden?.altBeden ?? null,
      ayakkabiNo: beden?.ayakkabiNo ?? null,
      eldivenNo: beden?.eldivenNo ?? null,
      hucreler,
    }
  })

  const grupPeriyotlari: Record<string, number | null> = {}
  for (const g of gruplar) grupPeriyotlari[g] = periyotMap.get(g) ?? null

  return {
    gruplar,
    bolumler: Array.from(bolumSet).sort((a, b) => a.localeCompare(b, 'tr')),
    grupPeriyotlari,
    satirlar,
  }
}
