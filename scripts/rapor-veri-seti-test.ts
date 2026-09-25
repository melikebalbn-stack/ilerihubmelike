/**
 * Rapor motoru — veri seti çalıştırıcı deneme betiği (SALT OKUMA).
 *   npx tsx scripts/rapor-veri-seti-test.ts
 * IFS ShopOrds (son N iş emri) ⟕ ipro_production_log (üretim toplamı) — OrderNo üzerinden left join.
 * TLS: rapor-katalog-yukle ile aynı CA yeniden-başlatma deseni.
 */
import 'dotenv/config'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

if (!process.env.NODE_EXTRA_CA_CERTS) {
  const ca = process.env.IFS_CA_CERT || path.join(homedir(), 'certs', 'rapidssl-tls-rsa-ca-g1.pem')
  if (!existsSync(ca)) { console.error(`❌ IFS CA sertifikası bulunamadı: ${ca} (IFS_CA_CERT verin)`); process.exit(2) }
  const r = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_EXTRA_CA_CERTS: ca } })
  process.exit(r.status ?? 1)
}

import { prisma } from '../src/lib/prisma'
import { ozetUygula, tanimDogrula, veriSetiCalistir } from '../src/lib/rapor/veri-seti'
import type { Ozet, VeriSetiTanim } from '../src/lib/rapor/tipler'

// ── Kaynak özeti (ozetUygula) — çevrimdışı birim denemeleri ──────────────

let hataSayisi = 0
function bekle(ad: string, gercek: unknown, beklenen: unknown) {
  const a = JSON.stringify(gercek), b = JSON.stringify(beklenen)
  if (a === b) console.log(`  ✓ ${ad}`)
  else { hataSayisi++; console.log(`  ✗ ${ad}\n      beklenen: ${b}\n      gerçek  : ${a}`) }
}

function ozetDenemeleri() {
  console.log('ozetUygula:')
  const stok = [
    { PartNo: 'A', LocationNo: '40', QtyOnhand: 0 },
    { PartNo: 'A', LocationNo: '64', QtyOnhand: 30 },
    { PartNo: 'A', LocationNo: '61', QtyOnhand: 20 },
    { PartNo: 'B', LocationNo: 'S1', QtyOnhand: 5 },
  ]
  const enb: Ozet = { grupla: ['PartNo'], sec: 'enbuyuk', alan: 'QtyOnhand' }
  bekle('argmax: grup başına en çok stoklu satır (tüm kolonlarıyla)',
    ozetUygula(stok, enb), [{ PartNo: 'A', LocationNo: '64', QtyOnhand: 30 }, { PartNo: 'B', LocationNo: 'S1', QtyOnhand: 5 }])
  bekle('argmin: en az stoklu satır',
    ozetUygula(stok, { grupla: ['PartNo'], sec: 'enkucuk', alan: 'QtyOnhand' }),
    [{ PartNo: 'A', LocationNo: '40', QtyOnhand: 0 }, { PartNo: 'B', LocationNo: 'S1', QtyOnhand: 5 }])

  bekle('eşitlikte ilk satır kazanır',
    ozetUygula([{ P: 'A', L: 'ilk', Q: 7 }, { P: 'A', L: 'sonra', Q: 7 }], { grupla: ['P'], sec: 'enbuyuk', alan: 'Q' }),
    [{ P: 'A', L: 'ilk', Q: 7 }])

  bekle('null/sayısal olmayan değer en sonda (dolu değer kazanır)',
    ozetUygula([{ P: 'A', L: 'bos', Q: null }, { P: 'A', L: 'dolu', Q: 1 }, { P: 'A', L: 'metin', Q: 'abc' }], { grupla: ['P'], sec: 'enbuyuk', alan: 'Q' }),
    [{ P: 'A', L: 'dolu', Q: 1 }])
  bekle('grupta yalnız null varsa ilk satır seçilir',
    ozetUygula([{ P: 'A', L: 'bir', Q: null }, { P: 'A', L: 'iki', Q: null }], { grupla: ['P'], sec: 'enbuyuk', alan: 'Q' }),
    [{ P: 'A', L: 'bir', Q: null }])
  bekle('null grup anahtarı kendi grubunu oluşturur',
    ozetUygula([{ P: null, Q: 1 }, { P: null, Q: 9 }, { P: 'A', Q: 2 }], { grupla: ['P'], sec: 'enbuyuk', alan: 'Q' }),
    [{ P: null, Q: 9 }, { P: 'A', Q: 2 }])

  bekle('gruplasız (grupla: []) → tüm satırlardan tek kazanan',
    ozetUygula(stok, { grupla: [], sec: 'enbuyuk', alan: 'QtyOnhand' }), [{ PartNo: 'A', LocationNo: '64', QtyOnhand: 30 }])
  bekle("sec:'ilk' → grup başına kaynaktan gelen ilk satır (alan gerekmez)",
    ozetUygula(stok, { grupla: ['PartNo'], sec: 'ilk' }),
    [{ PartNo: 'A', LocationNo: '40', QtyOnhand: 0 }, { PartNo: 'B', LocationNo: 'S1', QtyOnhand: 5 }])
  bekle('çok alanlı gruplama',
    ozetUygula([{ P: 'A', L: 'x', Q: 1 }, { P: 'A', L: 'x', Q: 5 }, { P: 'A', L: 'y', Q: 3 }], { grupla: ['P', 'L'], sec: 'enbuyuk', alan: 'Q' }),
    [{ P: 'A', L: 'x', Q: 5 }, { P: 'A', L: 'y', Q: 3 }])
  bekle('boş girdi', ozetUygula([], enb), [])

  console.log('tanimDogrula (ozet):')
  const taban = (ozet: unknown): VeriSetiTanim => ({
    kaynaklar: [{ ad: 'k', tip: 'ifs-odata', projeksiyon: 'P', entitySet: 'E', ...(ozet ? { ozet } : {}) } as never],
    birlestir: [], alanlar: { a: 'k.X' },
  })
  bekle('geçerli ozet hata vermez', tanimDogrula(taban({ grupla: ['PartNo'], sec: 'enbuyuk', alan: 'QtyOnhand' })), [])
  bekle("sec:'enbuyuk' ama alan yok → hata", tanimDogrula(taban({ grupla: ['PartNo'], sec: 'enbuyuk' })), ["k: ozet.sec='enbuyuk' için geçerli bir ozet.alan gerekli"])
  bekle('geçersiz sec → hata', tanimDogrula(taban({ grupla: [], sec: 'ortalama', alan: 'Q' })), ["k: ozet.sec 'enbuyuk' | 'enkucuk' | 'ilk' olmalı ('ortalama')"])
  bekle('geçersiz grupla alan adı → hata', tanimDogrula(taban({ grupla: ['Qty Onhand'], sec: 'ilk' })), ["k: ozet.grupla alan adı geçersiz: 'Qty Onhand'"])
}

const tanim: VeriSetiTanim = {
  kaynaklar: [
    {
      ad: 'isEmri', tip: 'ifs-odata', projeksiyon: 'ShopOrderHandling', entitySet: 'ShopOrds',
      select: ['OrderNo', 'ReleaseNo', 'PartNo', 'RevisedQtyDue', 'QtyComplete', 'Objstate', 'RevisedDueDate'],
      filtre: "Contract eq {p.contract} and RevisedDueDate ge {p.baslangic}",
      top: 200,
    },
    {
      ad: 'uretim', tip: 'postgres',
      sorgu: `SELECT "ifsOrderNo" AS order_no, SUM("qtyComplete")::int AS iyi, SUM("qtyScrap")::int AS hurda, COUNT(*)::int AS kayit
              FROM ipro_production_log WHERE "ifsOrderNo" IS NOT NULL AND "createdAt" >= $1 GROUP BY "ifsOrderNo"`,
      parametreler: ['baslangic'],
    },
  ],
  birlestir: [{ sol: 'isEmri.OrderNo', sag: 'uretim.order_no', tip: 'left' }],
  alanlar: {
    isEmriNo: 'isEmri.OrderNo', parca: 'isEmri.PartNo', planlanan: 'isEmri.RevisedQtyDue', ifsTamam: 'isEmri.QtyComplete',
    durum: 'isEmri.Objstate', termin: 'isEmri.RevisedDueDate', iproIyi: 'uretim.iyi', iproHurda: 'uretim.hurda',
  },
}

async function main() {
  ozetDenemeleri()
  if (hataSayisi) { console.error(`\n❌ ${hataSayisi} birim denemesi başarısız`); process.exitCode = 1; return }
  console.log('')
  const baslangic = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const sonuc = await veriSetiCalistir(tanim, { contract: process.env.IFS_CONTRACT ?? 'ILER2', baslangic })
  console.log('Kaynaklar:', sonuc.kaynakIstatistik, `toplam ${sonuc.toplamSureMs} ms`)
  console.log(`Satır: ${sonuc.satirlar.length}, IPRO eşleşen: ${sonuc.satirlar.filter((s) => s.iproIyi !== null).length}`)
  console.table(sonuc.satirlar.slice(0, 8))
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
