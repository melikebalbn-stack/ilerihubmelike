import { prisma } from '@/lib/prisma'

export type ServisKapasiteOzeti = {
  kapasite: number
  atananPersonelSayisi: number
  bosKoltuk: number
  dolulukOrani: number
}

export type TarihAralikliKayit = {
  baslangicTarihi: Date
  bitisTarihi: Date | null
}

export function tarihBaslangiciUTC(tarih: Date = new Date()): Date {
  return new Date(Date.UTC(tarih.getUTCFullYear(), tarih.getUTCMonth(), tarih.getUTCDate()))
}

export function tarihAraligiKapsar(kayit: TarihAralikliKayit, hesapTarihi: Date): boolean {
  const gun = tarihBaslangiciUTC(hesapTarihi)
  return kayit.baslangicTarihi <= gun && (kayit.bitisTarihi === null || kayit.bitisTarihi >= gun)
}

export function kapasiteOzetiHesapla(
  aracKapasiteleri: number[],
  atananPersonelSayisi: number,
): ServisKapasiteOzeti {
  const kapasite = aracKapasiteleri.reduce((toplam, deger) => toplam + deger, 0)
  const bosKoltuk = kapasite - atananPersonelSayisi
  const dolulukOrani = kapasite > 0
    ? (atananPersonelSayisi / kapasite) * 100
    : atananPersonelSayisi > 0 ? 100 : 0

  return { kapasite, atananPersonelSayisi, bosKoltuk, dolulukOrani }
}

export async function servisKapasiteOzetiGetir(
  guzergahId: string,
  dilimId: string,
  hesapTarihi: Date = new Date(),
): Promise<ServisKapasiteOzeti> {
  const gun = tarihBaslangiciUTC(hesapTarihi)
  const tarihFiltresi = {
    baslangicTarihi: { lte: gun },
    OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: gun } }],
  }

  const [aracAtamalari, atananPersonelSayisi] = await Promise.all([
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: {
        guzergahId,
        dilimId,
        rol: 'ANA',
        aktif: true,
        arac: { aktif: true },
        ...tarihFiltresi,
      },
      select: { arac: { select: { kapasite: true } } },
    }),
    prisma.servisPersonelAtama.count({
      where: {
        guzergahId,
        aktif: true,
        dilimler: { some: { dilimId } },
        ...tarihFiltresi,
      },
    }),
  ])

  return kapasiteOzetiHesapla(
    aracAtamalari.map((atama) => atama.arac.kapasite),
    atananPersonelSayisi,
  )
}
