import { durakKodu } from './servis-durak-kodu'
import type { TUM_GUZERGAHLAR, ARACLAR, SEFER_DILIMLERI } from './servis-tanim-verisi'

type IdliKayit = { id: string }

// 🔴 `args: any` bilinçli: gerçek PrismaClient'ın findFirst/create argüman
// tipleri (ServisGuzergahFindFirstArgs vb.) dar ve kontravaryant — `unknown`
// ile yazılırsa gerçek prisma nesnesi bu tipe atanamaz (strict function
// types). Bu arayüz yalnız mock edilebilirlik için var, gerçek prisma
// çağrılarının tip güvenliği zaten üst seviyede (seed-servis-tanim.ts) sağlanıyor.
type GuzergahDurakPrisma = {
  servisGuzergah: { findFirst: (args: any) => Promise<IdliKayit | null>; create: (args: any) => Promise<IdliKayit> }
  servisDurak: { findFirst: (args: any) => Promise<IdliKayit | null>; create: (args: any) => Promise<IdliKayit> }
  servisGuzergahDurak: { findFirst: (args: any) => Promise<IdliKayit | null>; create: (args: any) => Promise<unknown> }
}

// 🔴 Ders (bag +138 bug, prisma/seed-servis-tanim.ts): bagVar sorgusu
// APPLY'a bakmaksızın HER ZAMAN çalışmalı. Önceki sürüm bu sorguyu yalnız
// `if (APPLY)` içinde çalıştırıyordu; dry-run'da (APPLY=false) hiç sorgu
// atmadan `olusturulacak.bag++` yazıyordu — mevcut yerleşke/güzergâh/durak
// kodlarıyla koşulunca bile zaten var olan bağları da "yeni" sayıp yanlış
// rapor üretiyordu (ölçülen: +138, gerçek +32). Bu fonksiyon ayrı bir
// modülde çünkü seed-servis-tanim.ts modül seviyesinde main()'i kendi
// kendine çağırıyor — testten import edilirse gerçek DB'ye bağlanmaya
// çalışır. Saf mantık burada, prisma mock'lanarak test edilebilir
// (bkz. servis-tanim-seed-mantigi.test.ts).
export async function isleGuzergahVeDuraklar(
  prisma: GuzergahDurakPrisma,
  APPLY: boolean,
  yerleskeId: string,
  guzergahlar: typeof TUM_GUZERGAHLAR,
) {
  const olusturulacak = { guzergah: 0, durak: 0, bag: 0 }
  const mevcut = { guzergah: 0, durak: 0, bag: 0 }

  for (const g of guzergahlar) {
    const gVar = await prisma.servisGuzergah.findFirst({ where: { kod: g.kod } })
    gVar ? mevcut.guzergah++ : olusturulacak.guzergah++
    const gId =
      gVar?.id ??
      (APPLY
        ? (await prisma.servisGuzergah.create({ data: { kod: g.kod, ad: g.ad, yerleskeId } })).id
        : '(dry-run)')

    for (const d of g.duraklar) {
      const kod = durakKodu(g.kod, d.sira)
      const dVar = await prisma.servisDurak.findFirst({ where: { kod } })
      dVar ? mevcut.durak++ : olusturulacak.durak++
      const dId =
        dVar?.id ??
        (APPLY ? (await prisma.servisDurak.create({ data: { kod, ad: d.ad } })).id : '(dry-run)')

      const bagVar = await prisma.servisGuzergahDurak.findFirst({
        where: { guzergahId: gId, durakId: dId },
      })
      bagVar ? mevcut.bag++ : olusturulacak.bag++
      if (!bagVar && APPLY) {
        await prisma.servisGuzergahDurak.create({
          data: { guzergahId: gId, durakId: dId, sira: d.sira },
        })
      }
    }
  }

  return { olusturulacak, mevcut }
}

type AracPrisma = {
  servisFirma: { findFirst: (args: any) => Promise<IdliKayit | null>; create: (args: any) => Promise<IdliKayit> }
  servisArac: { findFirst: (args: any) => Promise<IdliKayit | null>; create: (args: any) => Promise<unknown> }
}

// 🔴 Idempotent anahtar `plaka` (ServisArac'ta `kod` alanı yok, plaka
// UNIQUE). Firma çözümü yalnız APPLY'da (ve yalnız araç gerçekten yeniyse)
// yapılır — dry-run'da firma var/yok ayrımı bu sayaca girmiyor, yalnız
// aracın kendisi girer (bkz. servis-tanim-verisi.ts ARAÇLAR yorumu: dev'de
// araçlar tek değil iki firmaya bağlı).
export async function isleAraclar(prisma: AracPrisma, APPLY: boolean, araclar: typeof ARACLAR) {
  const olusturulacak = { arac: 0 }
  const mevcut = { arac: 0 }

  for (const a of araclar) {
    const aracVar = await prisma.servisArac.findFirst({ where: { plaka: a.plaka } })
    aracVar ? mevcut.arac++ : olusturulacak.arac++
    if (!aracVar && APPLY) {
      const firmaVar = await prisma.servisFirma.findFirst({ where: { ad: a.firmaAd } })
      const firmaId = firmaVar?.id ?? (await prisma.servisFirma.create({ data: { ad: a.firmaAd } })).id
      await prisma.servisArac.create({ data: { plaka: a.plaka, kapasite: a.kapasite, firmaId } })
    }
  }

  return { olusturulacak, mevcut }
}

type DilimPrisma = {
  servisSeferDilimi: { findFirst: (args: any) => Promise<IdliKayit | null>; create: (args: any) => Promise<unknown> }
}

export async function isleSeferDilimleri(prisma: DilimPrisma, APPLY: boolean, dilimler: typeof SEFER_DILIMLERI) {
  const olusturulacak = { dilim: 0 }
  const mevcut = { dilim: 0 }

  for (const d of dilimler) {
    const dVar = await prisma.servisSeferDilimi.findFirst({ where: { kod: d.kod } })
    dVar ? mevcut.dilim++ : olusturulacak.dilim++
    if (!dVar && APPLY) {
      await prisma.servisSeferDilimi.create({
        data: { kod: d.kod, ad: d.ad, yon: d.yon, grupKodu: d.grupKodu, sira: d.sira },
      })
    }
  }

  return { olusturulacak, mevcut }
}
