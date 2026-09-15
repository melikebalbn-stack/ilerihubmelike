/* ============================================================================================
 * ⛔ TEK SEFERLİK — idempotent (tekrar çalıştırmak güvenli ama gereksiz).
 * Eski `CAKISMA_VAR` damgalı OEE kayıtlarını yeni sözleşmeye çeker: performance/quality/oee NULL,
 * hesapKaynagi='COKLU_IS'. (Eski kod çakışmada >1 perf/quality/oee yazıyordu — yanlış.) availability
 * dokunulmaz. Yeni kod bundan sonra zaten COKLU_IS + null yazıyor; bu script yalnız GEÇMİŞ kayıtlar için.
 * ============================================================================================
 *
 * VARSAYILAN: yalnız RAPOR (etkilenen satır sayısı). Uygulamak için: `--apply`.
 */
import { prisma } from '../../src/lib/prisma'

const APPLY = process.argv.includes('--apply')

async function main() {
  const kayitlar = await prisma.iproOeeKaydi.findMany({
    where: { hesapKaynagi: 'CAKISMA_VAR' },
    select: { id: true, tezgahKod: true, performance: true, quality: true, oee: true },
  })
  console.log(`=== ETKİLENEN: CAKISMA_VAR damgalı OEE kaydı = ${kayitlar.length} ===`)
  const dolu = kayitlar.filter((k) => k.performance != null || k.quality != null || k.oee != null).length
  console.log(`bunlardan perf/quality/oee dolu (null'a çekilecek) = ${dolu}`)
  for (const k of kayitlar.slice(0, 5)) {
    console.log(`  ${k.tezgahKod}: perf=${k.performance} quality=${k.quality} oee=${k.oee} → hepsi null, damga COKLU_IS`)
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] --apply verilmedi, YAZMA YAPILMADI.')
    return
  }
  console.log('\n[APPLY] güncelleniyor…')
  const r = await prisma.iproOeeKaydi.updateMany({
    where: { hesapKaynagi: 'CAKISMA_VAR' },
    data: { performance: null, quality: null, oee: null, hesapKaynagi: 'COKLU_IS' },
  })
  console.log(`[APPLY] tamam: ${r.count} kayıt COKLU_IS'e çekildi (perf/quality/oee null).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
