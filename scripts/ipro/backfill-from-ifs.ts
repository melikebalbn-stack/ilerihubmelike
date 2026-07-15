/**
 * IFS (canlı) → IproTezgah.ifsResourceId + ifsWorkCenterNo backfill.
 *
 * KAYNAK: canlı IFS `WorkCenterHandling.svc/Reference_WorkCenterResource` (Excel DEĞİL).
 * IFS otoriter: ResourceId sayısal (40401), WorkCenterNo sayısal (404),
 * Description = "<MAS_KOD> - <makine adı>". Eşleme buradan TÜRETİLİR, icat edilmez.
 *
 * KOD EŞLEŞTİRME: regex tahmini YOK. DB'deki gerçek 203 tezgah kodu ile
 * EN-UZUN-ÖNEK eşleşmesi (sınır: kod sonrası harf/rakam gelmemeli).
 *   "KR01-3 - 1.KAYNAK ROBOTU"  → KR01-3  (KR01 değil; en uzun kazanır)
 *   "PH08-60 TON PRES DİRİNLER" → PH08    (regex 'PH08-6' yakalıyordu — bug)
 *
 * Varsayılan DRY-RUN. Yazmak için --apply (dev-guard'lı).
 *
 * Çalıştırma (IFS creds terminal worktree'sinde; DATABASE_URL ipro .env'inden — SIRA ÖNEMLİ):
 *   npx tsx --env-file=/home/rokunet/projects/ilerihub-terminal/.env --env-file=.env \
 *     scripts/ipro/backfill-from-ifs.ts [--apply]
 *   (NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem gerekli)
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../../src/generated/prisma'

const APPLY = process.argv.includes('--apply')

interface IfsResource {
  rid: string
  wc: string
  desc: string
}

async function ifsResources(): Promise<IfsResource[]> {
  for (const k of ['IFS_INT_BASE_URL', 'IFS_TOKEN_URL', 'IFS_CLIENT_ID', 'IFS_CLIENT_SECRET']) {
    if (!process.env[k]) throw new Error(`DUR: ${k} env yok (IFS creds için terminal .env'ini de --env-file ile ver)`)
  }
  const MAIN = process.env.IFS_INT_BASE_URL!.replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
  const SVC = `${MAIN}WorkCenterHandling.svc`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.IFS_CLIENT_ID!,
    client_secret: process.env.IFS_CLIENT_SECRET!,
  })
  if (process.env.IFS_SCOPE) body.set('scope', process.env.IFS_SCOPE)
  const tr = await fetch(process.env.IFS_TOKEN_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tr.ok) throw new Error(`DUR: IFS token alınamadı (HTTP ${tr.status})`)
  const token = ((await tr.json()) as { access_token?: string }).access_token
  const H = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

  // Reference_WorkCenterResource = ÇALIŞAN set (diğer adaylar 400 veriyor — ölçüldü)
  for (const set of ['Reference_WorkCenterResource', 'ResourceDetailSet', 'WorkCenterResourceSet', 'ResourceSet']) {
    const r = await fetch(`${SVC}/${set}?$filter=Contract eq 'ILER2'&$top=500`, { headers: H })
    if (r.status !== 200) continue
    const v = ((await r.json()) as { value?: Record<string, unknown>[] }).value ?? []
    console.log(`IFS set: ${set} → ${v.length} resource`)
    return v
      .map((x) => ({
        rid: String(x.ResourceId ?? '').trim(),
        wc: String(x.WorkCenterNo ?? '').trim(),
        desc: String(x.Description ?? '').trim(),
      }))
      .filter((x) => x.rid)
  }
  throw new Error('DUR: çalışan resource set bulunamadı')
}

/** desc, kod ile başlıyor mu? (kod sonrası harf/rakam GELMEMELİ → PH08 ≠ PH081) */
function startsWithKod(desc: string, kod: string): boolean {
  const d = desc.toUpperCase()
  const k = kod.toUpperCase()
  if (!d.startsWith(k)) return false
  const next = d.charAt(k.length)
  return next === '' || !/[A-Z0-9]/.test(next)
}

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  console.log(`DB: ${url.replace(/:[^:@]+@/, ':****@')}`)
  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const tezgahlar = await prisma.iproTezgah.findMany({ select: { kod: true }, orderBy: { kod: 'asc' } })
    const kods = tezgahlar.map((t) => t.kod)
    console.log(`IPRO tezgah: ${kods.length}`)

    const ifs = await ifsResources()

    // EN-UZUN-ÖNEK: her IFS resource'u tek bir tezgah koduna bağla
    const byKod = new Map<string, IfsResource[]>()
    let parsed = 0
    for (const r of ifs) {
      const cands = kods.filter((k) => startsWithKod(r.desc, k))
      if (!cands.length) continue
      const kod = cands.reduce((a, b) => (b.length > a.length ? b : a))
      parsed++
      if (!byKod.has(kod)) byKod.set(kod, [])
      byKod.get(kod)!.push(r)
    }
    console.log(`kod çıkarılabilen IFS resource: ${parsed}`)

    // FAIL-FAST: bir kod > 1 resource'a eşleşiyorsa belirsiz → DUR
    const ambiguous = [...byKod.entries()].filter(([, v]) => v.length > 1)
    if (ambiguous.length) {
      console.error(`\n⛔ DUR — belirsiz eşleme (bir kod, çok resource): ${ambiguous.length}`)
      ambiguous.forEach(([k, v]) => console.error(`   ${k}: ${v.map((x) => `${x.rid}("${x.desc}")`).join(' | ')}`))
      process.exitCode = 1
      return
    }

    const eslesen = kods.filter((k) => byKod.has(k)).map((k) => ({ kod: k, ...byKod.get(k)![0] }))
    const eksik = kods.filter((k) => !byKod.has(k))
    const dbSet = new Set(kods)
    const tersYon = [...byKod.keys()].filter((k) => !dbSet.has(k))

    console.log(`\n=== EŞLEŞEN: ${eslesen.length} ===`)
    eslesen.slice(0, 25).forEach((e) => console.log(`  ${e.kod.padEnd(8)} → rid=${e.rid.padEnd(8)} wc=${e.wc.padEnd(6)} | ${e.desc}`))
    if (eslesen.length > 25) console.log(`  … +${eslesen.length - 25}`)

    const robot = eslesen.filter((e) => /^KR\d{2}-\d$/.test(e.kod))
    console.log(`\n=== ROBOT KAPISI TEYİDİ (ayrı resource mu?): ${robot.length} ===`)
    robot.forEach((e) => console.log(`  ${e.kod} → rid=${e.rid} wc=${e.wc}`))

    console.log(`\n=== IPRO'da var, IFS'te YOK (null kalacak): ${eksik.length} ===`)
    console.log('  ' + eksik.join(', '))
    console.log(`\n=== ters-yön (IFS'te kod var, IPRO'da yok): ${tersYon.length} ===`)
    if (tersYon.length) console.log('  ' + tersYon.join(', '))

    if (!APPLY) {
      console.log('\n--- DRY-RUN: yazma yok. Onaylarsan --apply. ---')
      return
    }

    // dev-guard: prod/staging'e ASLA yazma
    if (!url.includes('ilerihub_dev')) throw new Error(`GÜVENLİK DURDU: DATABASE_URL dev değil → ${url.replace(/:[^:@]+@/, ':****@')}`)

    let n = 0
    await prisma.$transaction(async (tx) => {
      // eski (Excel kaynaklı, yanlış) backfill'i temizle, sonra IFS gerçeğini yaz
      await tx.iproTezgah.updateMany({ data: { ifsResourceId: null, ifsWorkCenterNo: null } })
      for (const e of eslesen) {
        await tx.iproTezgah.update({ where: { kod: e.kod }, data: { ifsResourceId: e.rid, ifsWorkCenterNo: e.wc } })
        n++
      }
    })
    console.log(`\n✓ yazıldı: ${n} tezgah (eski backfill temizlendi; ${eksik.length} tezgah null)`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n⛔', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
