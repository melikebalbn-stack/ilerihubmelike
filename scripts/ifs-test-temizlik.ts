/**
 * IFS TEST temizlik betiği — eski kod ailesini (elle girilen 27 org / 113 pozisyon /
 * 9+1 labor class, ILR- dışı employee'ler, Hub'da pasif ILR'ler) kaldırır.
 *
 * GUARD'LAR:
 *  - Yalnız host 'ifscloudtest' içeriyorsa çalışır; başka URL'de hiçbir istek atmadan durur.
 *  - Varsayılan --dry-run: silinecekleri LİSTELER, silmez. Silmek için açıkça --apply.
 *  - Yeni aile (Hub'dan türeyen kodlar: P…, Y…, GM, GMY / P…N… labor class) ASLA silinmez.
 *  - Bir kayıt silinemezse (IFS bağımlılık / grant) raporlanır, betik DURMAZ.
 *
 * Sıra (brief): atamalar → employee (ILR- olmayanlar + Hub'da pasif ILR) → pozisyon → org → labor class → shop-floor.
 * NOT: IFS'te "atama" ayrı entity değil (CompanyPerson içinde); atama adımı = employee'nin
 * shop-floor site/employee kayıtları ve kendisi. Employee DELETE bu projeksiyonda desteklenmiyor
 * olabilir (PATCH gibi) — sonuç raporda görünür.
 *
 *   NODE_EXTRA_CA_CERTS=~/certs/rapidssl-tls-rsa-ca-g1.pem npx tsx scripts/ifs-test-temizlik.ts [--apply]
 */
import 'dotenv/config'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { chmodSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { prisma } from '../src/lib/prisma'
import {
  IfsSyncHatasi, empAnahtari, ifsBaglanti, lcAnahtari, listAllEmployees, listLaborClasses, listOrgs, listPositions, listSfEmployees, listSfSites,
  orgAnahtari, posAnahtari, sfeAnahtari, sfsAnahtari, sil,
} from '../src/lib/ifs/personel-sync/ifs-api'
import { SICIL_ONEKI } from '../src/lib/ifs/personel-sync/kodlar'

const APPLY = process.argv.includes('--apply')
/** Yeni aile tanıyıcıları — bunlara dokunulmaz. */
const YENI_ORG_POS = /^(P\d{4}(-N\d{3}|-K\d{2})?|Y\d{3}|GM|GMY)$/
const YENI_LC = /^P\d{4}N\d{3}[RM]?$/

interface Satir { adim: string; anahtar: string; etiket: string; sonuc: 'SİLİNDİ' | 'DRY' | 'HATA' | 'KORUNDU'; detay?: string }

async function main() {
  const { mainRoot, hostTest } = ifsBaglanti()
  console.log(`IFS host: ${mainRoot.replace(/https?:\/\/([^/]+).*/, '$1')} — ${hostTest ? 'TEST' : 'TEST DEĞİL'} — mod: ${APPLY ? 'APPLY (silinecek)' : 'dry-run'}`)
  if (!hostTest) { console.error('❌ Bu betik yalnız ifscloudtest host\'unda çalışır. Hiçbir istek atılmadı. DUR.'); process.exit(2) }

  const [emps, orgs, poss, lcs, sfes, sfss] = await Promise.all([listAllEmployees(), listOrgs(), listPositions(), listLaborClasses(), listSfEmployees(), listSfSites()])
  const hubPasif = new Set((await prisma.personnel.findMany({ where: { aktif: false, sicilNo: { startsWith: SICIL_ONEKI } }, select: { sicilNo: true } })).map((p) => p.sicilNo!))
  const hubAktif = new Set((await prisma.personnel.findMany({ where: { aktif: true, sicilNo: { startsWith: SICIL_ONEKI } }, select: { sicilNo: true } })).map((p) => p.sicilNo!))

  const hedefEmp = emps.filter((e) => !e.EmpNo.startsWith(SICIL_ONEKI) || hubPasif.has(e.EmpNo) || (!hubAktif.has(e.EmpNo) && !hubPasif.has(e.EmpNo)))
  const hedefPos = poss.filter((p) => !YENI_ORG_POS.test(p.PosCode))
  const hedefOrg = orgs.filter((o) => !YENI_ORG_POS.test(o.OrgCode))
  const hedefLc = lcs.filter((l) => !YENI_LC.test(l.LaborClassNo))
  const hedefEmpSet = new Set(hedefEmp.map((e) => e.EmpNo))
  const hedefSfs = sfss.filter((s) => hedefEmpSet.has(s.EmployeeId))
  const hedefSfe = sfes.filter((s) => hedefEmpSet.has(s.EmployeeId))

  console.log(`\nSilinecek adaylar: employee ${hedefEmp.length}/${emps.length} · pozisyon ${hedefPos.length}/${poss.length} · org ${hedefOrg.length}/${orgs.length} · labor class ${hedefLc.length}/${lcs.length} · sf-site ${hedefSfs.length} · sf-employee ${hedefSfe.length}`)
  console.log(`Korunan (yeni aile): org ${orgs.length - hedefOrg.length}, pozisyon ${poss.length - hedefPos.length}, labor class ${lcs.length - hedefLc.length}; ILR aktif employee ${emps.filter((e) => hubAktif.has(e.EmpNo)).length}`)

  const rapor: Satir[] = []
  const dene = async (adim: string, anahtar: string, etiket: string, yol: string) => {
    if (!APPLY) { rapor.push({ adim, anahtar, etiket, sonuc: 'DRY' }); return }
    try { await sil(yol); rapor.push({ adim, anahtar, etiket, sonuc: 'SİLİNDİ' }) }
    catch (e) { rapor.push({ adim, anahtar, etiket, sonuc: 'HATA', detay: e instanceof IfsSyncHatasi ? `${e.status} ${e.detay.slice(0, 160)}` : (e as Error).message }) }
  }

  // 1) Atamalar / shop-floor katmanları (employee silinebilsin diye önce bunlar)
  for (const s of hedefSfs) await dene('1-sf-site', s.EmployeeId, `lc=${s.PrimaryLaborClass} ${s.Objstate}`, sfsAnahtari(s.EmployeeId))
  for (const s of hedefSfe) await dene('1-sf-employee', s.EmployeeId, '', sfeAnahtari(s.EmployeeId))
  // 2) Employee: ILR- olmayanlar + Hub'da pasif ILR + Hub'da hiç olmayan ILR
  for (const e of hedefEmp) await dene('2-employee', e.EmpNo, `${e.InternalDisplayName ?? ''} org=${e.OrgCode} pos=${e.PosCode}${hubPasif.has(e.EmpNo) ? ' (Hub pasif)' : e.EmpNo.startsWith(SICIL_ONEKI) ? ' (Hub\'da yok)' : ' (elle)'}`, empAnahtari(e.EmpNo))
  // 3) Pozisyon (eski aile)
  for (const p of hedefPos) await dene('3-pozisyon', p.PosCode, p.PositionTitle, posAnahtari(p.PosCode))
  // 4) Org (eski aile) — alt→üst: SupOrgCode dolu olanlar önce
  for (const o of [...hedefOrg].sort((a, b) => Number(b.SupOrgCode && b.SupOrgCode !== '*') - Number(a.SupOrgCode && a.SupOrgCode !== '*'))) await dene('4-org', o.OrgCode, o.OrgName, orgAnahtari(o.OrgCode))
  // 5) Labor class (eski aile) — ManufacturingLaborClassesHandling (grant yoksa 403 raporlanır)
  for (const l of hedefLc) await dene('5-labor-class', l.LaborClassNo, l.LaborClassDescription, lcAnahtari(l.LaborClassNo))

  const say = (s: Satir['sonuc']) => rapor.filter((r) => r.sonuc === s).length
  console.log(`\nSonuç: silindi ${say('SİLİNDİ')} · dry ${say('DRY')} · hata ${say('HATA')}`)
  for (const r of rapor.filter((x) => x.sonuc === 'HATA')) console.log(`  ✗ ${r.adim} ${r.anahtar} ${r.etiket}: ${r.detay}`)
  if (!APPLY) for (const r of rapor.slice(0, 400)) console.log(`  DRY ${r.adim.padEnd(14)} ${r.anahtar.padEnd(12)} ${r.etiket}`)

  const dosya = path.join(process.cwd(), 'uploads', `ifs-temizlik-${APPLY ? 'apply' : 'dry'}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`)
  mkdirSync(path.dirname(dosya), { recursive: true }); writeFileSync(dosya, JSON.stringify(rapor, null, 1)); chmodSync(dosya, 0o600)
  console.log(`→ ${dosya}`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
