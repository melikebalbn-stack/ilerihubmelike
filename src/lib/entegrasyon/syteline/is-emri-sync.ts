import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'
import { getIfsConfig } from '@/lib/ifs/config'
import {
  listWorkCenterResources,
  getShopOrd,
  getInventoryPart,
  createShopOrd,
  createShopOrderOperation,
  listShopOrderOperationNos,
  IfsHttpError,
} from '@/lib/ifs/is-emri-sync'
import { getIsEmrileri, getIsEmrileriByJobs, getIsEmriOperasyonlari, type SytelineIsEmriBaslik } from '@/lib/syteline/is-emri'
import {
  isEmriMapla,
  type IsEmriReferans,
  type IsEmriEslemeHaritalari,
  type IsEmriBaslikCikti,
  type IsEmriOperasyonCikti,
} from './is-emri-mapper'

const ENTITY = 'IS_EMRI'
const WATERMARK_MIN = new Date('1900-01-01T00:00:00Z')
const MAX_DENEME = 5

/** Tipli obje → Prisma Json input (adlandırılmış interface'lerde index-signature yok). */
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue

/**
 * SyteEsleme (entity=IS_EMRI, aktif) → mapper haritaları. TEZGAH: Syteline RESID → IFS ResourceId.
 * Tablo yok/okuma hatası → boş harita (mapper sabit davranışa düşer).
 */
async function eslemeHaritalari(): Promise<IsEmriEslemeHaritalari> {
  const harita: IsEmriEslemeHaritalari = { tezgah: new Map() }
  try {
    const rows = await prisma.syteEsleme.findMany({
      where: { entity: ENTITY, aktif: true },
      select: { tip: true, kaynakDeger: true, hedefDeger: true },
    })
    for (const r of rows) {
      if (r.tip === 'TEZGAH') harita.tezgah!.set(r.kaynakDeger.trim(), r.hedefDeger.trim())
    }
  } catch {
    /* SyteEsleme okunamadı → boş harita. */
  }
  return harita
}

/**
 * Başlık listesi → { baslik girdisi + operasyon satırları } (her başlık için operasyonları çeker).
 * suffix null ise 0 varsayılır (Syteline operasyon sorgusu için).
 */
async function operasyonlariTopla(
  basliklar: SytelineIsEmriBaslik[],
): Promise<{ job: string; baslik: SytelineIsEmriBaslik; operasyonlar: Awaited<ReturnType<typeof getIsEmriOperasyonlari>> }[]> {
  const out: { job: string; baslik: SytelineIsEmriBaslik; operasyonlar: Awaited<ReturnType<typeof getIsEmriOperasyonlari>> }[] = []
  for (const b of basliklar) {
    const job = (b.job ?? '').trim()
    if (!job) continue
    const suffix = b.suffix ?? 0
    const operasyonlar = await getIsEmriOperasyonlari(job, suffix)
    out.push({ job, baslik: b, operasyonlar })
  }
  return out
}

export interface EksikSebep {
  sebep: string
  adet: number
  kategori: 'IFS_TEMEL_VERI' | 'SYTELINE_VERI' | 'HUB_ESLEME'
  ornekler: string[]
}

function sebepKategori(sebep: string): EksikSebep['kategori'] {
  if (sebep.startsWith('tezgah IFS') || sebep.startsWith('malzeme IFS')) return 'IFS_TEMEL_VERI'
  if (sebep.startsWith('çevrim yok') || sebep.startsWith('kaynak yok')) return 'HUB_ESLEME'
  return 'SYTELINE_VERI'
}

/**
 * EKSİKLER analizi — DB'ye YAZMADAN tüm serbest iş emirlerini mapper'dan geçirip hata dağılımı.
 * Her sebep için adet + kategori + ilk 5 örnek (job).
 */
export async function isEmriEksiklerAnalizi(): Promise<{ okunan: number; sebepler: EksikSebep[] }> {
  const contract = getIfsConfig().contract
  const [basliklar, kaynakHaritasi, esleme] = await Promise.all([
    getIsEmrileri(WATERMARK_MIN),
    listWorkCenterResources(),
    eslemeHaritalari(),
  ])
  const ref: IsEmriReferans = { contract, kaynakHaritasi, esleme }
  const isler = await operasyonlariTopla(basliklar)
  const agg = new Map<string, { adet: number; ornekler: string[] }>()
  for (const { job, baslik, operasyonlar } of isler) {
    const r = isEmriMapla(baslik, operasyonlar, ref)
    if (!('hata' in r)) continue
    const cur = agg.get(r.hata) ?? { adet: 0, ornekler: [] }
    cur.adet++
    if (cur.ornekler.length < 5) cur.ornekler.push(job)
    agg.set(r.hata, cur)
  }
  const sebepler = [...agg.entries()]
    .map(([sebep, v]) => ({ sebep, adet: v.adet, kategori: sebepKategori(sebep), ornekler: v.ornekler }))
    .sort((a, b) => b.adet - a.adet)
  return { okunan: isler.length, sebepler }
}

export interface IsEmriSyncOzet {
  dryRun: boolean
  okunan: number
  uygun: number
  hataliSatir: number
  hataDagilimi: Record<string, number>
  ornekHatalar: { item: string; hata: string }[]
  bekleyen: number
  yazilan: number
  hata: number
  atlanan: number
  hatalar: { kaynakAnahtar: string; durum: string; hata: string | null; deneme: number }[]
}

type Payload = { baslik?: IsEmriBaslikCikti; operasyonlar?: IsEmriOperasyonCikti[] }

/**
 * Syteline → IFS iş emri senkronu (v1, yalnız oluşturma). Malzeme runPartSync deseninin kardeşi.
 * dryRun=true: DB'ye/IFS'e YAZMAZ, yalnız mapper sonuçlarını raporlar, watermark ilerlemez.
 */
export async function runIsEmriSync(opts: { dryRun?: boolean; batch?: number } = {}): Promise<IsEmriSyncOzet> {
  const dryRun = !!opts.dryRun
  const contract = getIfsConfig().contract
  const envBatch = Number(process.env.SYTE_SYNC_BATCH ?? 50) || 50
  const batch = opts.batch && opts.batch > 0 ? Math.min(500, Math.floor(opts.batch)) : envBatch

  // (a) watermark
  const durum = await prisma.syteSyncDurum.findUnique({ where: { entity: ENTITY } })
  const watermark = durum?.sonRecordDate ?? WATERMARK_MIN

  // (b) Syteline başlıkları + IFS kaynak haritası + Hub eşlemeleri (run başına BİR KEZ)
  const [basliklar, kaynakHaritasi, esleme] = await Promise.all([
    getIsEmrileri(watermark),
    listWorkCenterResources(),
    eslemeHaritalari(),
  ])
  const ref: IsEmriReferans = { contract, kaynakHaritasi, esleme }

  // (c) her başlık → operasyonları çek → mapper → sayım + upsert (dryRun'da DB'ye yazmaz)
  const isler = await operasyonlariTopla(basliklar)
  let atlanan = 0
  let uygun = 0
  let hataliSatir = 0
  const hataDagilimi: Record<string, number> = {}
  const ornekHatalar: { item: string; hata: string }[] = []
  for (const { job, baslik, operasyonlar } of isler) {
    const sonuc = isEmriMapla(baslik, operasyonlar, ref)
    if ('hata' in sonuc) {
      hataliSatir++
      hataDagilimi[sonuc.hata] = (hataDagilimi[sonuc.hata] ?? 0) + 1
      if (ornekHatalar.length < 20) ornekHatalar.push({ item: job, hata: sonuc.hata })
      if (!dryRun) {
        await prisma.syteSyncKayit.upsert({
          where: { entity_kaynakAnahtar: { entity: ENTITY, kaynakAnahtar: job } },
          update: { durum: 'HATA', hata: sonuc.hata, payload: asJson({ hata: sonuc.hata }), kaynakRecordDate: baslik.RecordDate },
          create: {
            entity: ENTITY, kaynakAnahtar: job, hash: '', durum: 'HATA', hata: sonuc.hata,
            payload: asJson({ hata: sonuc.hata }), kaynakRecordDate: baslik.RecordDate,
          },
        })
      }
      continue
    }
    uygun++
    if (dryRun) continue
    const mevcut = await prisma.syteSyncKayit.findUnique({
      where: { entity_kaynakAnahtar: { entity: ENTITY, kaynakAnahtar: job } },
      select: { hash: true, durum: true },
    })
    if (mevcut && mevcut.hash === sonuc.hash && mevcut.durum === 'YAZILDI') {
      atlanan++
      continue
    }
    await prisma.syteSyncKayit.upsert({
      where: { entity_kaynakAnahtar: { entity: ENTITY, kaynakAnahtar: job } },
      update: {
        hash: sonuc.hash, durum: 'BEKLIYOR', hata: null,
        payload: asJson({ baslik: sonuc.baslik, operasyonlar: sonuc.operasyonlar }), kaynakRecordDate: baslik.RecordDate,
      },
      create: {
        entity: ENTITY, kaynakAnahtar: job, hash: sonuc.hash, durum: 'BEKLIYOR',
        payload: asJson({ baslik: sonuc.baslik, operasyonlar: sonuc.operasyonlar }), kaynakRecordDate: baslik.RecordDate,
      },
    })
  }

  // (d) yazılacaklar: BEKLIYOR veya (HATA && deneme<5), en fazla batch, en eski önce.
  const islenecekler = dryRun
    ? []
    : await prisma.syteSyncKayit.findMany({
        where: { entity: ENTITY, OR: [{ durum: 'BEKLIYOR' }, { durum: 'HATA', denemeSayisi: { lt: MAX_DENEME } }] },
        orderBy: { kaynakRecordDate: 'asc' },
        take: batch,
      })

  // İşlenecekleri GÜNCEL eşlemeyle yeniden map etmek için kaynak başlık+operasyonları çek.
  const kaynakMap = new Map<string, { baslik: SytelineIsEmriBaslik; operasyonlar: Awaited<ReturnType<typeof getIsEmriOperasyonlari>> }>()
  if (islenecekler.length > 0) {
    const basliklar2 = await getIsEmrileriByJobs(islenecekler.map((k) => k.kaynakAnahtar))
    const isler2 = await operasyonlariTopla(basliklar2)
    for (const it of isler2) if (!kaynakMap.has(it.job)) kaynakMap.set(it.job, { baslik: it.baslik, operasyonlar: it.operasyonlar })
  }

  let yazilan = 0
  let hata = 0
  for (const kayit of islenecekler) {
    let baslik: IsEmriBaslikCikti | undefined
    let operasyonlar: IsEmriOperasyonCikti[] | undefined
    const kaynak = kaynakMap.get(kayit.kaynakAnahtar)
    if (kaynak) {
      const yeni = isEmriMapla(kaynak.baslik, kaynak.operasyonlar, ref)
      if ('hata' in yeni) {
        // Güncel eşlemeyle artık kaynak hatası — IFS'e gidilmez, deneme artmaz.
        await prisma.syteSyncKayit.update({
          where: { id: kayit.id },
          data: { durum: 'HATA', hata: yeni.hata, payload: asJson({ hata: yeni.hata }) },
        })
        hata++
        continue
      }
      baslik = yeni.baslik
      operasyonlar = yeni.operasyonlar
      await prisma.syteSyncKayit.update({
        where: { id: kayit.id },
        data: { hash: yeni.hash, payload: asJson({ baslik: yeni.baslik, operasyonlar: yeni.operasyonlar }) },
      })
    } else {
      const p = kayit.payload as Payload | null
      baslik = p?.baslik
      operasyonlar = p?.operasyonlar
    }
    if (!baslik || !operasyonlar) continue

    try {
      // Parça IFS'te yoksa yazılamaz (retry'da malzeme senkronu gelince oluşur).
      const part = await getInventoryPart(contract, baslik.PartNo)
      if (!part) throw new IfsHttpError(0, `malzeme IFS'te yok: ${baslik.PartNo}`)

      // Başlık: yoksa oluştur (varsa retry — operasyonlardan devam et).
      const mevcutSO = await getShopOrd(baslik.OrderNo)
      if (!mevcutSO) await createShopOrd(baslik as unknown as Record<string, unknown>)
      const varOplar = mevcutSO ? await listShopOrderOperationNos(baslik.OrderNo) : new Set<number>()

      // Operasyonlar sırayla — biri patlarsa kaçıncı olduğunu raporla, başlık IFS'te kalır.
      for (let i = 0; i < operasyonlar.length; i++) {
        const op = operasyonlar[i]
        if (varOplar.has(op.OperationNo)) continue
        try {
          await createShopOrderOperation(op as unknown as Record<string, unknown>)
        } catch (e) {
          const mesaj =
            e instanceof IfsHttpError
              ? `operasyon[${i}] (op ${op.OperationNo}): ${e.status} ${typeof e.body === 'string' ? e.body : JSON.stringify(e.body)}`
              : `operasyon[${i}] (op ${op.OperationNo}): ${(e as Error)?.message ?? 'IFS hata'}`
          throw new IfsHttpError(e instanceof IfsHttpError ? e.status : 500, mesaj)
        }
      }

      await prisma.syteSyncKayit.update({
        where: { id: kayit.id },
        data: { durum: 'YAZILDI', ifsAnahtar: baslik.OrderNo, hata: mevcutSO ? 'başlık zaten vardı' : null },
      })
      yazilan++
    } catch (e) {
      const mesaj =
        e instanceof IfsHttpError
          ? typeof e.body === 'string'
            ? e.body
            : `${e.status} ${JSON.stringify(e.body)}`
          : (e as Error)?.message ?? 'IFS yazım hatası'
      await prisma.syteSyncKayit.update({
        where: { id: kayit.id },
        data: { durum: 'HATA', hata: mesaj, denemeSayisi: { increment: 1 }, sonDenemeAt: new Date() },
      })
      hata++
    }
  }

  // (e) watermark = bu run'da OKUNAN başlıkların max RecordDate'i (yalnız gerçek çalışmada).
  const maxRecordDate = basliklar.reduce<Date | null>((mx, b) => (!mx || b.RecordDate > mx ? b.RecordDate : mx), null)
  const bekleyen = await prisma.syteSyncKayit.count({ where: { entity: ENTITY, durum: 'BEKLIYOR' } })
  if (!dryRun) {
    const sonOzet = { okunan: isler.length, bekleyen, yazilan, hata }
    await prisma.syteSyncDurum.upsert({
      where: { entity: ENTITY },
      update: {
        sonCalismaAt: new Date(),
        ...(maxRecordDate ? { sonRecordDate: maxRecordDate } : {}),
        sonOzet: asJson(sonOzet),
      },
      create: {
        entity: ENTITY,
        sonRecordDate: maxRecordDate ?? undefined,
        sonCalismaAt: new Date(),
        sonOzet: asJson(sonOzet),
      },
    })
  }

  // (f) özet + ilk 20 hata
  const hatalar = (
    await prisma.syteSyncKayit.findMany({
      where: { entity: ENTITY, durum: 'HATA' },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { kaynakAnahtar: true, durum: true, hata: true, denemeSayisi: true },
    })
  ).map((h) => ({ kaynakAnahtar: h.kaynakAnahtar, durum: h.durum, hata: h.hata, deneme: h.denemeSayisi }))

  return { dryRun, okunan: isler.length, uygun, hataliSatir, hataDagilimi, ornekHatalar, bekleyen, yazilan, hata, atlanan, hatalar }
}
