/**
 * Bir sicilin IFS'teki istihdam durumunu DÖKER — yalnız okur, hiçbir şey yazmaz.
 *
 * Neden: 11.10.2026 gece senkronunda ILR-01155 "round-trip: Finish 200 ama
 * EmployeeStatus *≠ISTEN AYRILMIS" hatası verdi. Çıkış tarihi ve ayrılma nedeni
 * yazıldı, statü kodu yapışmadı. Bu betik IFS'teki gerçek satırları gösterir:
 * hangi dönem açık, hangi statü yazılı, şirkette tanımlı statü kodları neler.
 *
 *   npx tsx scripts/ifs/personel-durum.ts ILR-01155
 *
 * SUNUCUDA (IFS ortamı + sertifika):
 *   cd ~/projects/ilerihub
 *   set -a; . .env; . .env.local; set +a
 *   export NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem
 *   npx tsx scripts/ifs/personel-durum.ts ILR-01155
 */
import 'dotenv/config'
import { istek, listEmployeeStatuses, IfsSyncHatasi } from '../../src/lib/ifs/personel-sync/ifs-api'
import { IFS_COMPANY } from '../../src/lib/ifs/personel-sync/kodlar'

const arg = process.argv[2]
if (!arg) {
  console.error('Kullanım: npx tsx scripts/ifs/personel-durum.ts <SICIL>   (ör. ILR-01155)')
  console.error('          npx tsx scripts/ifs/personel-durum.ts --ayrilanlar   (çıkışı olan tüm dönemler)')
  process.exit(1)
}
const empNo = arg

const q = (s: string) => s.replace(/'/g, "''")
const enc = encodeURIComponent
type Sayfa<T> = { value?: T[] }

function yaz(baslik: string, satir: Record<string, unknown> | null) {
  console.log(`\n── ${baslik} ──`)
  if (!satir) return console.log('  (kayıt yok)')
  for (const [k, v] of Object.entries(satir)) {
    if (k.startsWith('@')) continue
    console.log(`  ${k.padEnd(28)} ${v === null || v === '' ? '(boş)' : String(v)}`)
  }
}

/**
 * Çıkışı olan TÜM dönemler — statünün çıkış tarihine göre mi türediğini ölçer.
 * Çıkışı geçmişte olanlar ISTEN AYRILMIS, bugün/gelecekte olanlar `*`/`**` ise
 * statüyü IFS tarihe göre yazıyor demektir; bizim PATCH'imiz suçlu değildir.
 */
async function ayrilanlar() {
  const yol =
    `EmploymentPeriodsHandling.svc/EmpEmployedTimes?$filter=` +
    enc(`CompanyId eq '${IFS_COMPANY}' and DateOfLeaving ne null`) +
    `&$select=EmpNo,SeqNo,DateOfLeaving,EmployeeStatus&$orderby=DateOfLeaving desc&$top=60`
  const satirlar = (await istek<Sayfa<Record<string, unknown>>>(yol)).body.value ?? []
  const bugun = new Date().toISOString().slice(0, 10)
  console.log(`\n── Çıkışı olan dönemler (${satirlar.length}, yeniden eskiye) · bugün=${bugun} ──`)
  for (const s of satirlar) {
    const cikis = String(s.DateOfLeaving ?? '-').slice(0, 10)
    const nerede = cikis < bugun ? 'geçmiş' : cikis === bugun ? 'BUGÜN' : 'gelecek'
    console.log(
      `  ${String(s.EmpNo).padEnd(12)} çıkış=${cikis} (${nerede.padEnd(7)}) statü=${String(s.EmployeeStatus ?? '(boş)')}`
    )
  }

  const sayac = new Map<string, Map<string, number>>()
  for (const s of satirlar) {
    const cikis = String(s.DateOfLeaving ?? '').slice(0, 10)
    const nerede = cikis < bugun ? 'geçmiş' : cikis === bugun ? 'bugün' : 'gelecek'
    const st = String(s.EmployeeStatus ?? '(boş)')
    if (!sayac.has(nerede)) sayac.set(nerede, new Map())
    const i = sayac.get(nerede)!
    i.set(st, (i.get(st) ?? 0) + 1)
  }
  console.log('\n── Çıkış tarihi × statü ──')
  for (const [nerede, i] of sayac) {
    for (const [st, n] of [...i].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${nerede.padEnd(8)} ${st.padEnd(18)} ${n}`)
    }
  }
}

async function main() {
  if (empNo === '--ayrilanlar') return ayrilanlar()
  console.log(`Şirket=${IFS_COMPANY}  sicil=${empNo}`)

  // 1) Çalışan kartı
  try {
    const emp = await istek<Record<string, unknown>>(
      `EmployeesHandling.svc/CompanyEmployeeSet(CompanyId='${IFS_COMPANY}',EmpNo='${q(empNo)}')`
    )
    yaz('Çalışan kartı (CompanyEmployeeSet)', emp.body)
  } catch (e) {
    console.log(`\n── Çalışan kartı ──\n  HATA — ${(e as Error).message}`)
  }

  // 2) TÜM istihdam dönemleri — hangisi açık, hangisi kapalı
  const yol =
    `EmploymentPeriodsHandling.svc/EmpEmployedTimes?$filter=` +
    enc(`CompanyId eq '${IFS_COMPANY}' and EmpNo eq '${q(empNo)}'`) +
    `&$select=SeqNo,EmpNo,DateOfEmployment,DateOfLeaving,LeavingCauseId,LeavingCauseType,EmployeeStatus,LeavingNotificationDate&$orderby=SeqNo desc&$top=20`
  const donemler = (await istek<Sayfa<Record<string, unknown>>>(yol)).body.value ?? []
  console.log(`\n── İstihdam dönemleri (${donemler.length} satır, yeniden eskiye) ──`)
  if (!donemler.length) console.log('  (kayıt yok)')
  for (const d of donemler) {
    console.log(
      `  SeqNo=${String(d.SeqNo).padEnd(4)} giriş=${String(d.DateOfEmployment ?? '-').slice(0, 10)}` +
        `  çıkış=${String(d.DateOfLeaving ?? '-').slice(0, 10)}` +
        `  statü=${String(d.EmployeeStatus ?? '(boş)')}` +
        `  neden=${String(d.LeavingCauseId ?? '-')}/${String(d.LeavingCauseType ?? '-')}`
    )
  }

  // 3) Şirkette tanımlı statü kodları — 'ISTEN AYRILMIS' var mı, nasıl yazılı
  try {
    const statuler = await listEmployeeStatuses()
    console.log(`\n── Tanımlı statü kodları (${statuler.length}) ──`)
    for (const s of statuler) {
      console.log(
        `  SeqNo=${String(s.SeqNo).padEnd(4)} "${s.EmployeeStatus}"  Active=${String(s.Active)}  Preliminary=${String(s.Preliminary ?? '-')}  Obsolete=${String(s.StatusObsolete ?? '-')}`
      )
    }
  } catch (e) {
    const h = e as IfsSyncHatasi
    console.log(`\n── Tanımlı statü kodları ──\n  HATA — ${h.message}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
