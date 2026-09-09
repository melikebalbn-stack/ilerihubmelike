import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'
import { getIfsConfig } from '@/lib/ifs/config'
import {
  listIsoUnits,
  listAccountingGroups,
  listProductCodes,
  getPartCatalog,
  getInventoryPart,
  createPartCatalog,
  createInventoryPart,
  IfsHttpError,
} from '@/lib/ifs/part-sync'
import { getMalzemeler } from '@/lib/syteline/malzeme'
import { malzemeMapla, type MalzemeReferans, type MalzemeEnvanter, type MalzemeKatalog } from './malzeme-mapper'

const ENTITY = 'MALZEME'
const WATERMARK_MIN = new Date('1900-01-01T00:00:00Z')
const MAX_DENEME = 5

/** Tipli obje → Prisma Json input (adlandırılmış interface'lerde index-signature yok). */
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue

export interface PartSyncOzet {
  dryRun: boolean
  okunan: number // Syteline'dan çekilen satır
  // Mapper sonuçları — bu çalışmada bellekte sayıldı (dryRun'da da dolu; DB'ye yazılmaz).
  uygun: number // mapper'dan geçen (IFS'e yazılabilir) satır
  hataliSatir: number // mapper'ın kaynak hatasıyla elediği satır
  hataDagilimi: Record<string, number> // { "birim yok: XX": n, "ürün kodu yok: YY": n, ... }
  ornekHatalar: { item: string; hata: string }[] // ilk 20 (item + hata)
  bekleyen: number // çalışma sonrası BEKLIYOR sayısı (DB)
  yazilan: number // bu çalışmada IFS'e yazılan
  hata: number // bu çalışmada IFS yazımında HATA'ya düşen
  atlanan: number // hash aynı + YAZILDI (dokunulmadı)
  hatalar: { kaynakAnahtar: string; durum: string; hata: string | null; deneme: number }[] // DB'deki HATA'lardan ilk 20
}

/**
 * Syteline → IFS malzeme senkronu (v1, yalnız oluşturma).
 * dryRun=true: DB'ye YAZMAZ, yalnız ne yapılacağını raporlar (IFS'e de yazmaz, watermark ilerlemez).
 */
export async function runPartSync(opts: { dryRun?: boolean } = {}): Promise<PartSyncOzet> {
  const dryRun = !!opts.dryRun
  const contract = getIfsConfig().contract
  const batch = Number(process.env.SYTE_SYNC_BATCH ?? 50) || 50

  // (a) watermark
  const durum = await prisma.syteSyncDurum.findUnique({ where: { entity: ENTITY } })
  const watermark = durum?.sonRecordDate ?? WATERMARK_MIN

  // (b) Syteline satırları (TÜMÜ, limit yok) + IFS referans setleri (run başına BİR KEZ)
  const [satirlar, birimler, muhasebeGruplari, urunKodlari] = await Promise.all([
    getMalzemeler(watermark),
    listIsoUnits(),
    listAccountingGroups(),
    listProductCodes(),
  ])
  const ref: MalzemeReferans = { birimler, muhasebeGruplari, urunKodlari, contract }

  // (c) her satır → mapper → sayım (bellekte) + upsert (dryRun'da DB'ye yazmaz)
  let atlanan = 0
  let uygun = 0
  let hataliSatir = 0
  const hataDagilimi: Record<string, number> = {}
  const ornekHatalar: { item: string; hata: string }[] = []
  for (const satir of satirlar) {
    const kaynakAnahtar = (satir.item ?? '').trim()
    if (!kaynakAnahtar) continue
    const sonuc = malzemeMapla(satir, ref)

    if ('hata' in sonuc) {
      // Bellekte say (dryRun'da da) — hata dağılımı + ilk 20 örnek.
      hataliSatir++
      hataDagilimi[sonuc.hata] = (hataDagilimi[sonuc.hata] ?? 0) + 1
      if (ornekHatalar.length < 20) ornekHatalar.push({ item: kaynakAnahtar, hata: sonuc.hata })
      if (!dryRun) {
        await prisma.syteSyncKayit.upsert({
          where: { entity_kaynakAnahtar: { entity: ENTITY, kaynakAnahtar } },
          // Kaynak hatası → denemeSayisi ARTMAZ (IFS'e gidilmedi). payload'da hata izi.
          update: { durum: 'HATA', hata: sonuc.hata, payload: asJson({ hata: sonuc.hata }), kaynakRecordDate: satir.RecordDate },
          create: {
            entity: ENTITY, kaynakAnahtar, hash: '', durum: 'HATA', hata: sonuc.hata,
            payload: asJson({ hata: sonuc.hata }), kaynakRecordDate: satir.RecordDate,
          },
        })
      }
      continue
    }

    uygun++ // mapper'dan geçti (IFS'e yazılabilir)
    if (dryRun) continue // dryRun: DB'ye dokunma; sayım yeterli

    const mevcut = await prisma.syteSyncKayit.findUnique({
      where: { entity_kaynakAnahtar: { entity: ENTITY, kaynakAnahtar } },
      select: { hash: true, durum: true },
    })
    // hash aynı + zaten YAZILDI → dokunma (idempotent).
    if (mevcut && mevcut.hash === sonuc.hash && mevcut.durum === 'YAZILDI') {
      atlanan++
      continue
    }
    if (!dryRun) {
      await prisma.syteSyncKayit.upsert({
        where: { entity_kaynakAnahtar: { entity: ENTITY, kaynakAnahtar } },
        update: {
          hash: sonuc.hash, durum: 'BEKLIYOR', hata: null,
          payload: asJson({ katalog: sonuc.katalog, envanter: sonuc.envanter }), kaynakRecordDate: satir.RecordDate,
        },
        create: {
          entity: ENTITY, kaynakAnahtar, hash: sonuc.hash, durum: 'BEKLIYOR',
          payload: asJson({ katalog: sonuc.katalog, envanter: sonuc.envanter }), kaynakRecordDate: satir.RecordDate,
        },
      })
    }
  }

  // (d) yazılacaklar: BEKLIYOR veya (HATA && deneme<5), en fazla batch, en eski önce.
  const islenecekler = dryRun
    ? [] // dryRun: DB durumuna göre değil, yalnız bu run'da mapper'dan geçen BEKLIYOR adayları raporlanır (aşağıda)
    : await prisma.syteSyncKayit.findMany({
        where: {
          entity: ENTITY,
          OR: [{ durum: 'BEKLIYOR' }, { durum: 'HATA', denemeSayisi: { lt: MAX_DENEME } }],
        },
        orderBy: { kaynakRecordDate: 'asc' },
        take: batch,
      })

  let yazilan = 0
  let hata = 0
  for (const kayit of islenecekler) {
    const payload = kayit.payload as { katalog?: MalzemeKatalog; envanter?: MalzemeEnvanter } | null
    const envanter = payload?.envanter
    const katalog = payload?.katalog
    if (!envanter || !katalog) {
      // Mapper hatası kalıntısı — IFS'e gidilmez (BEKLIYOR filtresine düşmemeli ama garanti).
      continue
    }
    try {
      const mevcutIfs = await getInventoryPart(contract, envanter.PartNo)
      if (mevcutIfs) {
        await prisma.syteSyncKayit.update({
          where: { id: kayit.id },
          data: { durum: 'YAZILDI', ifsAnahtar: envanter.PartNo, hata: "IFS'te zaten vardı" },
        })
        yazilan++
        continue
      }
      // Katalog yoksa önce onu oluştur, sonra envanter (site) parçası.
      const katVar = await getPartCatalog(envanter.PartNo)
      if (!katVar) await createPartCatalog(katalog as unknown as Record<string, unknown>)
      await createInventoryPart(envanter as unknown as Record<string, unknown>)
      await prisma.syteSyncKayit.update({
        where: { id: kayit.id },
        data: { durum: 'YAZILDI', ifsAnahtar: envanter.PartNo, hata: null },
      })
      yazilan++
    } catch (e) {
      const mesaj =
        e instanceof IfsHttpError
          ? `${e.status} ${typeof e.body === 'string' ? e.body : JSON.stringify(e.body)}`
          : (e as Error)?.message ?? 'IFS yazım hatası'
      await prisma.syteSyncKayit.update({
        where: { id: kayit.id },
        data: { durum: 'HATA', hata: mesaj, denemeSayisi: { increment: 1 }, sonDenemeAt: new Date() },
      })
      hata++
    }
  }

  // (e) watermark = bu run'da OKUNAN satırların max RecordDate'i (yalnız gerçek çalışmada).
  const maxRecordDate = satirlar.reduce<Date | null>((mx, s) => (!mx || s.RecordDate > mx ? s.RecordDate : mx), null)
  const bekleyen = await prisma.syteSyncKayit.count({ where: { entity: ENTITY, durum: 'BEKLIYOR' } })
  if (!dryRun) {
    const sonOzet = { okunan: satirlar.length, bekleyen, yazilan, hata }
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

  return {
    dryRun,
    okunan: satirlar.length,
    uygun,
    hataliSatir,
    hataDagilimi,
    ornekHatalar,
    bekleyen,
    yazilan,
    hata,
    atlanan,
    hatalar,
  }
}
