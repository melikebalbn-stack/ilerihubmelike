import { durakKodu } from './servis-durak-kodu'
import type { AracTanimi, GuzergahTanimi, SeferDilimiTanimi } from './servis-tanim-verisi'

// Seed'in saf mantığı. prisma/seed-servis-tanim.ts modül seviyesinde main()'i
// çağırdığı için testten import edilemez; mantık burada, prisma mock'lanarak
// test edilir.
//
// 🔴 TEK PLAN, İKİ MOD: dry-run ve apply AYNI planla() fonksiyonunu kullanır.
// planla() yalnız OKUR ve apply'da oluşacak HER satırı (yerleşke, firma,
// güzergâh, durak, bağ, araç, sefer dilimi) varlık türüne göre listeler.
// Dry-run bu planı yazdırır; apply aynı planı uygula() ile yazar ve gerçekten
// yaptığı create sayısını döner. İki sayı farklıysa çağıran hata verir.
// (Eski sürümde dry-run ayrı bir hesap yapıyordu: "bag +138" hatası böyle doğdu.)

type IdliKayit = { id: string }

// 🔴 `args: any` bilinçli: gerçek PrismaClient'ın findFirst/create argüman
// tipleri dar ve kontravaryant; `unknown` ile yazılırsa gerçek prisma nesnesi
// bu tipe atanamaz. Bu arayüz mock edilebilirlik için var.
type Model = {
  findFirst: (args: any) => Promise<IdliKayit | null>
  create: (args: any) => Promise<IdliKayit>
}

export type TanimPrisma = {
  servisYerleske: Model
  servisFirma: Model
  servisGuzergah: Model
  servisDurak: Model
  servisGuzergahDurak: Model
  servisArac: Model
  servisSeferDilimi: Model
}

export type Sayim = {
  yerleske: number
  firma: number
  guzergah: number
  durak: number
  bag: number
  arac: number
  dilim: number
}

export const SAYIM_ANAHTARLARI = ['yerleske', 'firma', 'guzergah', 'durak', 'bag', 'arac', 'dilim'] as const

export type PlanGirdisi = {
  yerleskeKod: string
  yerleskeAd: string
  guzergahlar: GuzergahTanimi[]
  araclar: AracTanimi[]
  dilimler: SeferDilimiTanimi[]
}

export type Plan = {
  yerleske: { kod: string; ad: string; varId: string | null }
  /** Yalnız YENİ araç için gereken firmalar. Araçsız modda boş. */
  firmalar: { ad: string; varId: string | null }[]
  guzergahlar: {
    kod: string
    ad: string
    varId: string | null
    duraklar: { sira: number; ad: string; kod: string; varId: string | null; bagVar: boolean }[]
  }[]
  araclar: { plaka: string; kapasite: number; firmaAd: string; var: boolean }[]
  dilimler: (SeferDilimiTanimi & { var: boolean })[]
}

const bos = (): Sayim => ({ yerleske: 0, firma: 0, guzergah: 0, durak: 0, bag: 0, arac: 0, dilim: 0 })

// ----------------------------------------------------------------------------
// CLI + savunma kontrolleri (DB'ye dokunmadan ÖNCE)
// ----------------------------------------------------------------------------

export class TanimHatasi extends Error {}

export type CliSecenekleri = { db: string; yerleskeKod: string; yerleskeAd: string; apply: boolean }

/** Dry-run dahil: yerleşke parametresi yoksa açık hata (yerleskeId NOT NULL). */
export function cliCoz(args: string[]): CliSecenekleri {
  const arg = (ad: string) => args.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3)
  const zorunlu = (deger: string | undefined, bayrak: string, aciklama: string) => {
    if (!deger) throw new TanimHatasi(`--${bayrak}=<deger> ZORUNLU. ${aciklama}`)
    return deger
  }
  if (args.some((a) => a === '--firma-ad' || a.startsWith('--firma-ad='))) {
    throw new TanimHatasi(
      '--firma-ad KALDIRILDI: seed firma yazmaz. Firma yalnız gerçek adıyla, araç verisiyle birlikte eklenir.',
    )
  }
  return {
    db: zorunlu(arg('db'), 'db', 'Örnek: --db=ilerihub_dev_elif'),
    yerleskeKod: zorunlu(arg('yerleske-kod'), 'yerleske-kod', "İdari İşler'den alınan gerçek yerleşke kodu."),
    yerleskeAd: zorunlu(arg('yerleske-ad'), 'yerleske-ad', "İdari İşler'den alınan gerçek yerleşke adı."),
    apply: args.includes('--apply'),
  }
}

/** Firma/araç adında "PLACEHOLDER" varsa DB'ye dokunmadan durdurur. */
export function placeholderKontrol(araclar: AracTanimi[]): void {
  for (const a of araclar) {
    for (const alan of [a.firmaAd, a.plaka]) {
      if (/placeholder/i.test(alan)) {
        throw new TanimHatasi(
          `PLACEHOLDER içeren araç/firma verisi yazılmaz (plaka "${a.plaka}"). Gerçek ad gelene kadar araç verisi seed dışında kalır.`,
        )
      }
    }
  }
}

// ----------------------------------------------------------------------------
// PLAN — yalnız okur
// ----------------------------------------------------------------------------

export async function planla(prisma: TanimPrisma, girdi: PlanGirdisi): Promise<Plan> {
  placeholderKontrol(girdi.araclar) // her şeyden önce, tek DB okumasından bile önce

  const yerleskeVar = await prisma.servisYerleske.findFirst({ where: { kod: girdi.yerleskeKod } })
  const plan: Plan = {
    yerleske: { kod: girdi.yerleskeKod, ad: girdi.yerleskeAd, varId: yerleskeVar?.id ?? null },
    firmalar: [],
    guzergahlar: [],
    araclar: [],
    dilimler: [],
  }

  for (const g of girdi.guzergahlar) {
    const gVar = await prisma.servisGuzergah.findFirst({ where: { kod: g.kod } })
    const duraklar: Plan['guzergahlar'][number]['duraklar'] = []
    for (const d of g.duraklar) {
      const kod = durakKodu(g.kod, d.sira)
      const dVar = await prisma.servisDurak.findFirst({ where: { kod } })
      // Bağ ancak güzergâh VE durak zaten varsa DB'de olabilir; biri yeniyse bağ kesin yenidir.
      const bagVar =
        gVar && dVar
          ? (await prisma.servisGuzergahDurak.findFirst({ where: { guzergahId: gVar.id, durakId: dVar.id } })) !== null
          : false
      duraklar.push({ sira: d.sira, ad: d.ad, kod, varId: dVar?.id ?? null, bagVar })
    }
    plan.guzergahlar.push({ kod: g.kod, ad: g.ad, varId: gVar?.id ?? null, duraklar })
  }

  const firmaGorulen = new Set<string>()
  for (const a of girdi.araclar) {
    const aracVar = await prisma.servisArac.findFirst({ where: { plaka: a.plaka } })
    plan.araclar.push({ plaka: a.plaka, kapasite: a.kapasite, firmaAd: a.firmaAd, var: aracVar !== null })
    if (!aracVar && !firmaGorulen.has(a.firmaAd)) {
      firmaGorulen.add(a.firmaAd)
      const firmaVar = await prisma.servisFirma.findFirst({ where: { ad: a.firmaAd } })
      plan.firmalar.push({ ad: a.firmaAd, varId: firmaVar?.id ?? null })
    }
  }

  for (const d of girdi.dilimler) {
    const dVar = await prisma.servisSeferDilimi.findFirst({ where: { kod: d.kod } })
    plan.dilimler.push({ ...d, var: dVar !== null })
  }

  return plan
}

/** Plandan türetilen sayımlar: oluşturulacak ve mevcut korunan. */
export function planSayimi(plan: Plan): { olusturulacak: Sayim; mevcut: Sayim } {
  const olusturulacak = bos()
  const mevcut = bos()
  const say = (anahtar: keyof Sayim, var_: boolean) => (var_ ? mevcut : olusturulacak)[anahtar]++

  say('yerleske', plan.yerleske.varId !== null)
  for (const f of plan.firmalar) say('firma', f.varId !== null)
  for (const g of plan.guzergahlar) {
    say('guzergah', g.varId !== null)
    for (const d of g.duraklar) {
      say('durak', d.varId !== null)
      say('bag', d.bagVar)
    }
  }
  for (const a of plan.araclar) say('arac', a.var)
  for (const d of plan.dilimler) say('dilim', d.var)
  return { olusturulacak, mevcut }
}

// ----------------------------------------------------------------------------
// UYGULA — aynı planı yazar, gerçekten yaptığı create sayısını döner
// ----------------------------------------------------------------------------

export async function uygula(prisma: TanimPrisma, plan: Plan): Promise<Sayim> {
  const yazilan = bos()

  const yerleskeId =
    plan.yerleske.varId ??
    (yazilan.yerleske++, (await prisma.servisYerleske.create({ data: { kod: plan.yerleske.kod, ad: plan.yerleske.ad } })).id)

  const firmaIdleri = new Map<string, string>()
  for (const f of plan.firmalar) {
    const id = f.varId ?? (yazilan.firma++, (await prisma.servisFirma.create({ data: { ad: f.ad } })).id)
    firmaIdleri.set(f.ad, id)
  }

  for (const g of plan.guzergahlar) {
    const gId =
      g.varId ??
      (yazilan.guzergah++, (await prisma.servisGuzergah.create({ data: { kod: g.kod, ad: g.ad, yerleskeId } })).id)
    for (const d of g.duraklar) {
      const dId =
        d.varId ?? (yazilan.durak++, (await prisma.servisDurak.create({ data: { kod: d.kod, ad: d.ad } })).id)
      if (!d.bagVar) {
        yazilan.bag++
        await prisma.servisGuzergahDurak.create({ data: { guzergahId: gId, durakId: dId, sira: d.sira } })
      }
    }
  }

  for (const a of plan.araclar) {
    if (a.var) continue
    yazilan.arac++
    await prisma.servisArac.create({
      data: { plaka: a.plaka, kapasite: a.kapasite, firmaId: firmaIdleri.get(a.firmaAd) },
    })
  }

  for (const d of plan.dilimler) {
    if (d.var) continue
    yazilan.dilim++
    await prisma.servisSeferDilimi.create({
      data: { kod: d.kod, ad: d.ad, yon: d.yon, grupKodu: d.grupKodu, sira: d.sira },
    })
  }

  return yazilan
}
