/**
 * rapor_katalog Türkçe etiket başlangıç sözlüğü — sık kullanılan iş emri alanları.
 *   npx tsx scripts/rapor-katalog-etiket.ts
 * Aynı alan adı her entity'de aynı anlama geldiği için sözlükteki ad geçen TÜM satırlara uygulanır.
 * Mevcut (elle girilmiş) etiketler EZİLMEZ — yalnız boş olanlar doldurulur. Tekrar koşum güvenli.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const SOZLUK: Record<string, string> = {
  OrderNo: 'İş Emri No',
  PartNo: 'Parça No',
  RevisedQtyDue: 'Planlanan Miktar',
  QtyComplete: 'Tamamlanan Miktar',
  RevisedDueDate: 'Termin Tarihi',
  Contract: 'Site',
  ObjState: 'Durum',
  Objstate: 'Durum', // IFS'te gerçek yazım (katalogda gizli=aktif:false, ama etiket dursun)
  Description: 'Açıklama',
  StartDate: 'Başlangıç Tarihi',
  FinishDate: 'Bitiş Tarihi',
  CustomerNo: 'Müşteri No',
  CustomerName: 'Müşteri Adı',
}

async function main() {
  let toplam = 0
  for (const [alan, etiket] of Object.entries(SOZLUK)) {
    const r = await prisma.raporKatalog.updateMany({
      where: { kaynakTipi: 'IFS_ODATA', alan, OR: [{ etiket: null }, { etiket: '' }] },
      data: { etiket },
    })
    const mevcut = await prisma.raporKatalog.count({ where: { kaynakTipi: 'IFS_ODATA', alan } })
    console.log(`${alan.padEnd(16)} → ${etiket.padEnd(20)} ${String(r.count).padStart(4)} etiketlendi / ${mevcut} satır`)
    toplam += r.count
  }
  const dolu = await prisma.raporKatalog.count({ where: { etiket: { not: null } } })
  console.log(`\nToplam ${toplam} alan etiketlendi; katalogda etiketli satır: ${dolu}`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
