/**
 * Hub → IFS personel senkronu — PİLOT betiği (faz 1).
 *
 *   npx tsx scripts/ifs-personel-pilot.ts                       → TAM dry-run (yazmaz), plan özeti + ATLA listesi
 *   npx tsx scripts/ifs-personel-pilot.ts --siciller A,B,C       → kapsamlı dry-run (yalnız o kişiler + bağımlıları)
 *   npx tsx scripts/ifs-personel-pilot.ts --siciller A,B --yaz   → GERÇEK yazım + round-trip GET doğrulaması (tablo)
 *   npx tsx scripts/ifs-personel-pilot.ts --tam --yaz            → TAM plan, yalnız ORG/POZISYON/LABOR_CLASS yazılır
 *                                                                  (EMPLOYEE/SF katmanlarına DOKUNMAZ; boş koltuk pozisyonları için)
 *
 * Yalnız ifscloudtest host'unda yazar. Kuyruk: BellekKuyruk (tablo migration'ı uygulanmadan koşar).
 * NODE_EXTRA_CA_CERTS=~/certs/rapidssl-tls-rsa-ca-g1.pem gerekir. Çıktı: uploads/ifs-pilot-<damga>.json (600).
 */
// .env import anında (prisma DATABASE_URL için), .env.local (IFS_*) çağrı anında yeter — IFS env'i tembel okunur.
import 'dotenv/config'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { chmodSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { prisma } from '../src/lib/prisma'
import { planla, planOzetiMetni } from '../src/lib/ifs/personel-sync/plan'
import { uygula } from '../src/lib/ifs/personel-sync/uygula'
import { BellekKuyruk } from '../src/lib/ifs/personel-sync/kuyruk'
import { IFS_SYNC_AKTOR_ID } from '../src/lib/ifs/personel-sync/kodlar'
import { alanFarki, ayrilmaAnahtari, listEmployeeStatuses, getEmployee, getSfSite, ifsBaglanti, istek, orgAnahtari, posAnahtari, sfeAnahtari, type IfsOrg, type IfsPos, type IfsSfEmployee } from '../src/lib/ifs/personel-sync/ifs-api'

const arg = (ad: string) => { const i = process.argv.indexOf(ad); return i >= 0 ? process.argv[i + 1] : undefined }
const YAZ = process.argv.includes('--yaz')
const TAM = process.argv.includes('--tam')
/** --tam ile yazılan varlıklar — kişi katmanı bilerek dışarıda. */
const TAM_VARLIKLAR = new Set(['ORG', 'POZISYON', 'LABOR_CLASS'])
const siciller = arg('--siciller')?.split(',').map((s) => s.trim()).filter(Boolean)

async function main() {
  const { mainRoot, hostTest } = ifsBaglanti()
  console.log(`IFS: ${mainRoot.replace(/https?:\/\/([^/]+).*/, '$1')} (${hostTest ? 'TEST' : 'PROD?'})  mod: ${YAZ ? 'YAZ' : 'dry-run'}  kapsam: ${siciller?.join(',') ?? 'TAM'}`)
  if (YAZ && !hostTest) { console.error('❌ Yazma yalnız ifscloudtest host\'unda. DUR.'); process.exit(2) }
  if (YAZ && !siciller?.length && !TAM) { console.error('❌ --yaz için --siciller zorunlu (pilot kapsamı) — ya da --tam (yalnız org/pozisyon/labor class).'); process.exit(2) }
  if (TAM && siciller?.length) { console.error('❌ --tam ile --siciller birlikte olmaz.'); process.exit(2) }

  const plan = await planla(prisma, siciller ? { siciller } : {})
  if (TAM) {
    // Kişi katmanı (EMPLOYEE/SF_*) ve kod listeleri (AYRILMA_NEDENI/CALISAN_STATUSU) plandan düşer;
    // yalnız yapı kalemleri (org/pozisyon/labor class) uygulanır.
    const once = plan.kalemler.length
    plan.kalemler = plan.kalemler.filter((k) => TAM_VARLIKLAR.has(k.varlik))
    console.log(`--tam: ${once} kalemden ${plan.kalemler.length} yapı kalemi (ORG/POZISYON/LABOR_CLASS) tutuldu`)
  }
  console.log('\n' + planOzetiMetni(plan))

  const atla = plan.kalemler.filter((k) => k.islem === 'ATLA')
  if (atla.length) { console.log(`\nATLA (${atla.length}):`); for (const k of atla) console.log(`  ${k.varlik.padEnd(12)} ${k.ifsAnahtar.padEnd(12)} ${k.sebep}  — ${k.etiket}`) }
  const yazilacak = plan.kalemler.filter((k) => k.islem !== 'NOOP' && k.islem !== 'ATLA')
  if (siciller) { console.log(`\nKalemler (${yazilacak.length} yazılacak):`); for (const k of yazilacak) console.log(`  ${k.islem.padEnd(6)} ${k.varlik.padEnd(12)} ${k.ifsAnahtar.padEnd(12)} ${k.etiket}${k.fark ? '  fark=' + JSON.stringify(k.fark) : ''}`) }

  const kuyruk = new BellekKuyruk()
  await kuyruk.ekle(plan.kalemler.map((k) => ({ varlikTipi: k.varlik, hubId: k.hubId, tetik: 'PILOT' })))
  const sonuc = await uygula(prisma, plan, { dryRun: !YAZ, kuyruk, actorId: IFS_SYNC_AKTOR_ID })
  console.log(`\nUygulama (${sonuc.dryRun ? 'KURU' : 'GERÇEK'}): yazıldı ${sonuc.ozet.yazildi} · hata ${sonuc.ozet.hata} · atlandı ${sonuc.ozet.atlandi} · noop ${sonuc.ozet.noop}`)
  for (const s of sonuc.kalemler.filter((x) => x.durum === 'HATA')) console.log(`  ✗ ${s.varlik} ${s.ifsAnahtar}: ${s.hata}`)

  // Round-trip doğrulama (yalnız gerçek yazımda)
  const rt: Array<Record<string, unknown>> = []
  if (YAZ) {
    console.log('\nRound-trip GET:')
    for (const k of plan.kalemler.filter((x) => x.islem === 'CREATE' || x.islem === 'UPDATE')) {
      let ok = false, detay = ''
      try {
        if (k.varlik === 'AYRILMA_NEDENI') { const { body } = await istek<{ LeavingCauseType: string; LeavingInitiatedBy: string }>(ayrilmaAnahtari(Number(k.ifsAnahtar))); ok = body.LeavingCauseType === (k.govde?.LeavingCauseType ?? body.LeavingCauseType); detay = `${body.LeavingCauseType} · ${body.LeavingInitiatedBy}` }
        else if (k.varlik === 'CALISAN_STATUSU') { const l = await listEmployeeStatuses(); const b = l.find((x) => x.EmployeeStatus === k.hubId); ok = !!b && b.Active === (k.govde?.Active ?? b.Active); detay = b ? `seq=${b.SeqNo} aktif=${b.Active} prelim=${b.Preliminary}` : 'YOK' }
        else if (k.varlik === 'ORG') { const { body } = await istek<IfsOrg>(orgAnahtari(k.ifsAnahtar)); ok = body.OrgName === (k.govde?.OrgName ?? body.OrgName); detay = `${body.OrgName} sup=${body.SupOrgCode}` }
        else if (k.varlik === 'POZISYON') { const { body } = await istek<IfsPos>(posAnahtari(k.ifsAnahtar)); ok = body.PositionTitle === (k.govde?.PositionTitle ?? body.PositionTitle); detay = body.PositionTitle }
        else if (k.varlik === 'LABOR_CLASS') { const { body } = await istek<{ value?: Array<{ LaborClassNo: string }> }>(`ShopFloorEmployeesHandling.svc/Reference_LaborClass?$filter=Contract%20eq%20'ILER2'%20and%20LaborClassNo%20eq%20'${k.ifsAnahtar}'`); ok = (body.value?.length ?? 0) > 0; detay = ok ? 'var' : 'yok' }
        else if (k.varlik === 'EMPLOYEE') {
          const c = await getEmployee(k.ifsAnahtar); const b = c?.body
          // Alan bazlı: atama (org/pos) + PATCH/CREATE ile yazılan her alan geri okunanla eşleşmeli.
          const atama = (k.govde?._atama as { OrgCode?: string; PosCode?: string } | undefined)
          const beklenenOrg = atama?.OrgCode ?? k.govde?.EmpOrgCode ?? k.govde?.OrgCode ?? b?.OrgCode
          const beklenenPos = atama?.PosCode ?? k.govde?.EmpPosCode ?? k.govde?.PosCode ?? b?.PosCode
          const yazilanAlanlar = Object.fromEntries(Object.entries(k.govde ?? {}).filter(([a]) => !a.startsWith('_') && a in (b ?? {})))
          const fark = b ? alanFarki(yazilanAlanlar, b as unknown as Record<string, unknown>) : ['kayıt yok']
          ok = !!b && b.OrgCode === beklenenOrg && b.PosCode === beklenenPos && fark.length === 0
          detay = b ? `org=${b.OrgCode} pos=${b.PosCode} giriş=${b.EmploymentDate} bitiş=${b.EmploymentEndDate} ad=${b.InternalDisplayName} cins=${b.Gender} master=${b.MasterEmployment}${fark.length ? ' UYUŞMAYAN: ' + fark.join('; ') : ''}` : 'YOK'
        }
        else if (k.varlik === 'SF_EMPLOYEE') { const { body } = await istek<IfsSfEmployee>(sfeAnahtari(k.ifsAnahtar)); ok = body.EmployeeId === k.ifsAnahtar; detay = `person=${body.PersonId}` }
        else if (k.varlik === 'SF_SITE') { const c = await getSfSite(k.ifsAnahtar); ok = !!c && c.body.PrimaryLaborClass === (k.govde?.PrimaryLaborClass ?? c.body.PrimaryLaborClass); detay = c ? `lc=${c.body.PrimaryLaborClass} durum=${c.body.Objstate}` : 'YOK' }
      } catch (e) { detay = (e as Error).message.slice(0, 140) }
      rt.push({ varlik: k.varlik, anahtar: k.ifsAnahtar, islem: k.islem, ok, detay })
      console.log(`  ${ok ? '✓' : '✗'} ${k.varlik.padEnd(12)} ${k.ifsAnahtar.padEnd(12)} ${k.islem.padEnd(6)} ${detay}`)
    }
  }

  const dosya = path.join(process.cwd(), 'uploads', `ifs-pilot-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`)
  mkdirSync(path.dirname(dosya), { recursive: true })
  writeFileSync(dosya, JSON.stringify({ plan, sonuc, roundTrip: rt }, null, 1)); chmodSync(dosya, 0o600)
  console.log(`\n→ ${dosya}`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
