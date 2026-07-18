/**
 * Depo hareket logu — IFS'e yazılan kalıcı depo işlemlerinin ILERIHub tarafındaki izi.
 *
 * TASARIM: Log yazımı ASLA asıl işlemi bozmaz. IFS'e yazma zaten başarıyla
 * tamamlandıktan sonra çağrılır; burada bir hata olursa yalnız console.error'a
 * düşer, throw EDİLMEZ. (Aksi halde başarılı bir stok hareketi, log yüzünden
 * kullanıcıya "başarısız" gösterilirdi.)
 */
import { prisma } from '@/lib/prisma'

export type DepoOlay = 'TOPLAMA_CIKIS' | 'STOK_TASIMA' | 'ETIKET_BASMA'

export interface DepoHareketGirdi {
  olay: DepoOlay
  userId: string
  kullaniciAd: string
  partNo: string
  lotBatchNo?: string | null
  miktar?: number | null
  kaynakLok?: string | null
  hedefLok?: string | null
  /** Toplama bağlamı — IFS iş emri satır anahtarı. */
  orderNo?: string | null
  releaseNo?: string | null
  sequenceNo?: string | null
  lineItemNo?: number | null
  /** Doluysa FIFO dışına çıkıldı ('Çok lot (COK_LOT)' dahil). */
  sapmaSebep?: string | null
  fifoOnerisi?: unknown
  /** ETIKET_BASMA: üretilen kalıcı BarcodeId listesi. */
  etiketIdler?: number[] | null
  detay?: unknown
}

/** Hareket kaydı yazar. Hata yutulur (asıl işlem etkilenmez). */
export async function logDepoHareket(girdi: DepoHareketGirdi): Promise<void> {
  try {
    await prisma.depoHareketLog.create({
      data: {
        olay: girdi.olay,
        userId: girdi.userId,
        kullaniciAd: girdi.kullaniciAd,
        partNo: girdi.partNo,
        lotBatchNo: girdi.lotBatchNo ?? null,
        miktar: girdi.miktar ?? null,
        kaynakLok: girdi.kaynakLok ?? null,
        hedefLok: girdi.hedefLok ?? null,
        orderNo: girdi.orderNo ?? null,
        releaseNo: girdi.releaseNo ?? null,
        sequenceNo: girdi.sequenceNo ?? null,
        lineItemNo: girdi.lineItemNo ?? null,
        sapmaSebep: girdi.sapmaSebep ?? null,
        fifoOnerisi: girdi.fifoOnerisi === undefined ? undefined : (girdi.fifoOnerisi as never),
        etiketIdler: girdi.etiketIdler === undefined ? undefined : (girdi.etiketIdler as never),
        detay: girdi.detay === undefined ? undefined : (girdi.detay as never),
      },
    })
  } catch (e) {
    // Log yazılamadı — işlem yine de başarılı. Sessiz kalmamak için konsola düş.
    console.error('[depo.hareket-log] kayıt yazılamadı', {
      olay: girdi.olay,
      partNo: girdi.partNo,
      hata: e instanceof Error ? e.message : String(e),
    })
  }
}
