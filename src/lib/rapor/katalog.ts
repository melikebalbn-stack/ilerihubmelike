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

/** Projeksiyonun $metadata'sını çeker, ayrıştırır, rapor_katalog'a upsert eder. */
export async function projeksiyonYukle(projeksiyon: string): Promise<KatalogYuklemeSonucu> {
  const t0 = Date.now()
  const entities = metadataAyristir(await metadataGetir(projeksiyon))
  const tumSatirlar = satirlar(entities)
  for (let i = 0; i < tumSatirlar.length; i += PARCA) {
    await parcaYaz(projeksiyon, tumSatirlar.slice(i, i + PARCA))
  }
  return { entitySayisi: entities.length, alanSayisi: tumSatirlar.length, sureMs: Date.now() - t0 }
}
