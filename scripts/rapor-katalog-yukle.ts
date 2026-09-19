/**
 * Rapor tasarımcısı — IFS $metadata → rapor_katalog yükleme.
 *
 *   npx tsx scripts/rapor-katalog-yukle.ts ShopOrdersHandling [Diger ...]  → verilen projeksiyonlar
 *   npx tsx scripts/rapor-katalog-yukle.ts                                 → PROJEKSIYONLAR listesinin tamamı
 *
 * Env: .env (DATABASE_URL) + .env.local (IFS_*).
 * Hata alan projeksiyon atlanır, diğerleri sürer; sonda özet. Çıkış kodu: hata varsa 1.
 *
 * TLS: IFS test sunucusunun zinciri Node'un varsayılan CA deposunda yok
 * (UNABLE_TO_VERIFY_LEAF_SIGNATURE). Node NODE_EXTRA_CA_CERTS'i yalnız süreç
 * başlarken okur; çalışma anında atamak etkisiz. Bu yüzden değişken yoksa script
 * kendini aynı argümanlarla (node + tsx loader + argv) yeniden başlatır.
 * CA yolu: IFS_CA_CERT env → yoksa ~/certs/rapidssl-tls-rsa-ca-g1.pem → o da yoksa hata.
 */
import 'dotenv/config'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

function caIleYenidenBaslat(): never | undefined {
  if (process.env.NODE_EXTRA_CA_CERTS) return undefined
  const ca = process.env.IFS_CA_CERT || path.join(homedir(), 'certs', 'rapidssl-tls-rsa-ca-g1.pem')
  if (!existsSync(ca)) {
    console.error(`❌ IFS CA sertifikası bulunamadı: ${ca}\n   IFS_CA_CERT=/yol/ca.pem verin ya da NODE_EXTRA_CA_CERTS ile çalıştırın.`)
    process.exit(2)
  }
  const r = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_EXTRA_CA_CERTS: ca },
  })
  process.exit(r.status ?? 1)
}
caIleYenidenBaslat()

import { prisma } from '../src/lib/prisma'
import { ifsBaglanti } from '../src/lib/ifs/personel-sync/ifs-api'
import { PROJEKSIYONLAR } from '../src/lib/rapor/ifs-metadata'
import { projeksiyonYukle } from '../src/lib/rapor/katalog'

async function main() {
  const secilen = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const liste: readonly string[] = secilen.length ? secilen : PROJEKSIYONLAR
  const { mainRoot, hostTest } = ifsBaglanti()
  console.log(`IFS: ${mainRoot.replace(/https?:\/\/([^/]+).*/, '$1')} (${hostTest ? 'TEST' : 'PROD?'})  projeksiyon: ${liste.length}`)

  const basarili: string[] = []
  const hatali: Array<{ ad: string; hata: string }> = []
  let toplamEntity = 0
  let toplamAlan = 0

  for (const ad of liste) {
    try {
      const s = await projeksiyonYukle(ad)
      toplamEntity += s.entitySayisi
      toplamAlan += s.alanSayisi
      basarili.push(ad)
      console.log(`✓ ${ad.padEnd(36)} entity ${String(s.entitySayisi).padStart(4)}  alan ${String(s.alanSayisi).padStart(6)}  ${s.sureMs} ms`)
    } catch (e) {
      const hata = e instanceof Error ? e.message : String(e)
      hatali.push({ ad, hata })
      console.log(`✗ ${ad.padEnd(36)} ATLANDI — ${hata.slice(0, 160)}`)
    }
  }

  console.log(`\nÖzet: ${basarili.length} başarılı, ${hatali.length} hatalı; toplam entity ${toplamEntity}, alan ${toplamAlan}`)
  for (const h of hatali) console.log(`  - ${h.ad}: ${h.hata.slice(0, 200)}`)
  process.exitCode = hatali.length ? 1 : 0
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
