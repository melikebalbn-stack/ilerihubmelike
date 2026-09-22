/**
 * Rapor tasarımcısı — veri kataloğu yükleme (rapor_katalog).
 *
 * Yazım stratejisi: 200'lük parçalar, her parça tek $transaction içinde upsert dizisi.
 * createMany+skipDuplicates seçilmedi: mevcut satırın veriTipi/anahtarMi'si güncellenmeli.
 * Tek dev transaction seçilmedi: binlerce alan → uzun kilit; parça başarısız olursa
 * öncekiler kalır, yeniden koşum idempotent.
 *
 * aktif: yeni satırda gizli→false, diğer→true. Güncellemede yalnız gizli alan false'a
 * çekilir; diğerlerine dokunulmaz ki rapor.katalog yetkilisinin elle pasifleştirdiği
 * alan her yüklemede geri açılmasın.
 */
import { prisma } from '@/lib/prisma'
import { metadataAyristir, metadataGetir, type MetadataEntity } from './ifs-metadata'

export interface KatalogYuklemeSonucu {
  entitySayisi: number
  alanSayisi: number
  /** Enum'a bağlı alan sayısı. */
  enumAlanSayisi: number
  /** Yazılan (kaynakAd, entity, alan, deger) satırı sayısı. */
  degerSayisi: number
  /** rapor_katalog_deger tablosu henüz yoksa (migration bekliyor) doldurulur. */
  degerUyarisi?: string
  sureMs: number
}

const PARCA = 200

interface KatalogSatiri { entity: string; alan: string; veriTipi: string; anahtarMi: boolean; gizli: boolean }

function satirlar(entities: MetadataEntity[]): KatalogSatiri[] {
  return entities.flatMap((e) => e.alanlar.map((a) => ({ entity: e.entity, ...a })))
}

async function parcaYaz(kaynakAd: string, parca: KatalogSatiri[]): Promise<void> {
  await prisma.$transaction(
    parca.map((s) =>
      prisma.raporKatalog.upsert({
        where: { kaynakAd_entity_alan: { kaynakAd, entity: s.entity, alan: s.alan } },
        create: {
          kaynakTipi: 'IFS_ODATA',
          kaynakAd,
          entity: s.entity,
          alan: s.alan,
          veriTipi: s.veriTipi,
          anahtarMi: s.anahtarMi,
          aktif: !s.gizli,
        },
        update: {
          veriTipi: s.veriTipi,
          anahtarMi: s.anahtarMi,
          ...(s.gizli ? { aktif: false } : {}),
        },
      }),
    ),
  )
}

interface DegerSatiri { entity: string; alan: string; deger: string }

/**
 * Enum alanlarının olası değerleri → rapor_katalog_deger. Etiket başta null, kaynak='ENUM'.
 * Mevcut satırın ETİKETİNE ve kaynağına DOKUNULMAZ (elle/AI çeviriler yeniden yüklemede korunur).
 */
async function degerParcaYaz(kaynakAd: string, parca: DegerSatiri[]): Promise<void> {
  await prisma.$transaction(
    parca.map((s) =>
      prisma.raporKatalogDeger.upsert({
        where: { kaynakAd_entity_alan_deger: { kaynakAd, entity: s.entity, alan: s.alan, deger: s.deger } },
        create: { kaynakAd, entity: s.entity, alan: s.alan, deger: s.deger, kaynak: 'ENUM' },
        update: {},
      }),
    ),
  )
}

/** Projeksiyonun $metadata'sını çeker, ayrıştırır, rapor_katalog + rapor_katalog_deger'e upsert eder. */
export async function projeksiyonYukle(projeksiyon: string): Promise<KatalogYuklemeSonucu> {
  const t0 = Date.now()
  const entities = metadataAyristir(await metadataGetir(projeksiyon))
  const tumSatirlar = satirlar(entities)
  for (let i = 0; i < tumSatirlar.length; i += PARCA) {
    await parcaYaz(projeksiyon, tumSatirlar.slice(i, i + PARCA))
  }

  const degerSatirlari: DegerSatiri[] = entities.flatMap((e) =>
    e.alanlar.flatMap((a) => (a.degerler ?? []).map((deger) => ({ entity: e.entity, alan: a.alan, deger }))),
  )
  const enumAlanSayisi = entities.reduce((t, e) => t + e.alanlar.filter((a) => a.degerler?.length).length, 0)
  let degerUyarisi: string | undefined
  let yazilan = 0
  try {
    for (let i = 0; i < degerSatirlari.length; i += PARCA) {
      await degerParcaYaz(projeksiyon, degerSatirlari.slice(i, i + PARCA))
      yazilan += Math.min(PARCA, degerSatirlari.length - i)
    }
  } catch (e) {
    // Tablo henüz yoksa katalog yüklemesi başarısız SAYILMAZ; alanlar yazıldı, değerler migration'ı bekler.
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2021') {
      degerUyarisi = `rapor_katalog_deger tablosu yok (migration bekliyor) — ${degerSatirlari.length} enum değeri yazılamadı`
      yazilan = 0
    } else throw e
  }

  return { entitySayisi: entities.length, alanSayisi: tumSatirlar.length, enumAlanSayisi, degerSayisi: yazilan, degerUyarisi, sureMs: Date.now() - t0 }
}
