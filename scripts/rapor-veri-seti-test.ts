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
import { veriSetiCalistir } from '../src/lib/rapor/veri-seti'
import type { VeriSetiTanim } from '../src/lib/rapor/tipler'

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
  const baslangic = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const sonuc = await veriSetiCalistir(tanim, { contract: process.env.IFS_CONTRACT ?? 'ILER2', baslangic })
  console.log('Kaynaklar:', sonuc.kaynakIstatistik, `toplam ${sonuc.toplamSureMs} ms`)
  console.log(`Satır: ${sonuc.satirlar.length}, IPRO eşleşen: ${sonuc.satirlar.filter((s) => s.iproIyi !== null).length}`)
  console.table(sonuc.satirlar.slice(0, 8))
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
