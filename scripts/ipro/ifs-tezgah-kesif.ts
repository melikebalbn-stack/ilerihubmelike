/**
 * IFS tezgah/kaynak KEŞFİ — SALT OKUMA, hiçbir yere yazmaz.
 *
 * Canlıya geçiş hazırlığı: MAS geçici kaynak, IFS kalıcı gerçek olacak.
 * Bu script "ne kadar hizalıyız" sorusunu ölçer, hizalamayı YAPMAZ.
 *
 * Kaynak: WorkCenterHandling.svc/Reference_WorkCenterResource (backfill-from-ifs.ts
 * ile aynı projeksiyon ve aynı en-uzun-önek eşleştirmesi — yöntem icat edilmedi).
 *
 *   npx tsx --env-file=/home/rokunet/projects/ilerihub-terminal/.env --env-file=.env \
 *     scripts/ipro/ifs-tezgah-kesif.ts
 *   (NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem gerekli)
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../../src/generated/prisma'

type IfsResource = { rid: string; wc: string; desc: string }

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

  const r = await fetch(`${SVC}/Reference_WorkCenterResource?$filter=Contract eq 'ILER2'&$top=1000`, { headers: H })
  if (r.status !== 200) throw new Error(`DUR: Reference_WorkCenterResource HTTP ${r.status}`)
  const v = ((await r.json()) as { value?: Record<string, unknown>[] }).value ?? []
  return v
    .map((x) => ({
      rid: String(x.ResourceId ?? '').trim(),
      wc: String(x.WorkCenterNo ?? '').trim(),
      desc: String(x.Description ?? '').trim(),
    }))
    .filter((x) => x.rid)
}

/** desc, kod ile başlıyor mu? Kod sonrası harf/rakam GELMEMELİ → PH08 ≠ PH081. */
function startsWithKod(desc: string, kod: string): boolean {
  const d = desc.toUpperCase()
  const k = kod.toUpperCase()
  if (!d.startsWith(k)) return false
  const next = d.charAt(k.length)
  return next === '' || !/[A-Z0-9]/.test(next)
}

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  console.log(`DB: ${url.replace(/:\/\/[^@]*@/, '://***@')}\n`)
  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const tezgahlar = await prisma.iproTezgah.findMany({
      select: { kod: true, ad: true, aktif: true, ifsResourceId: true, ifsWorkCenterNo: true },
      orderBy: { kod: 'asc' },
    })
    const kods = tezgahlar.map((t) => t.kod)
    const ifs = await ifsResources()
    console.log(`ILERIHub tezgah : ${tezgahlar.length}`)
    console.log(`IFS kaynak      : ${ifs.length}\n`)

    // ── En-uzun-önek eşleştirmesi (backfill ile birebir aynı yöntem) ──
    const byKod = new Map<string, IfsResource[]>()
    const eslesmeyenKaynak: IfsResource[] = []
    for (const r of ifs) {
      const adaylar = kods.filter((k) => startsWithKod(r.desc, k))
      if (!adaylar.length) {
        eslesmeyenKaynak.push(r)
        continue
      }
      const kod = adaylar.reduce((a, b) => (b.length > a.length ? b : a))
      if (!byKod.has(kod)) byKod.set(kod, [])
      byKod.get(kod)!.push(r)
    }

    // ── Sınıflandırma ──
    const bulundu: typeof tezgahlar = []
    const bulunamadi: typeof tezgahlar = []
    const cokluKaynak: { kod: string; kaynaklar: IfsResource[] }[] = []
    const tutarsiz: { kod: string; alan: string; bizde: string | null; ifs: string }[] = []
    const doluAmaEslesmeyen: typeof tezgahlar = []

    for (const t of tezgahlar) {
      const eslesen = byKod.get(t.kod)
      if (!eslesen || eslesen.length === 0) {
        bulunamadi.push(t)
        // Bizde ifsResourceId dolu ama IFS'te karşılığı yok → en tehlikeli hâl
        if (t.ifsResourceId || t.ifsWorkCenterNo) doluAmaEslesmeyen.push(t)
        continue
      }
      bulundu.push(t)
      if (eslesen.length > 1) cokluKaynak.push({ kod: t.kod, kaynaklar: eslesen })

      const r = eslesen[0]
      if (t.ifsResourceId && t.ifsResourceId !== r.rid) {
        tutarsiz.push({ kod: t.kod, alan: 'ifsResourceId', bizde: t.ifsResourceId, ifs: r.rid })
      }
      if (t.ifsWorkCenterNo && t.ifsWorkCenterNo !== r.wc) {
        tutarsiz.push({ kod: t.kod, alan: 'ifsWorkCenterNo', bizde: t.ifsWorkCenterNo, ifs: r.wc })
      }
    }

    const bosAlanli = bulundu.filter((t) => !t.ifsResourceId || !t.ifsWorkCenterNo)

    // ── Rapor ──
    console.log('═══ ÖZET ═══')
    console.log(`  IFS'te bulundu            : ${bulundu.length} / ${tezgahlar.length}`)
    console.log(`  IFS'te BULUNAMADI         : ${bulunamadi.length}`)
    console.log(`    └─ bizde alan DOLU ama IFS'te yok : ${doluAmaEslesmeyen.length}  ⚠`)
    console.log(`  Alanı BOŞ (eşleşti ama yazılmamış)  : ${bosAlanli.length}`)
    console.log(`  DOLU AMA YANLIŞ (tutarsız)          : ${tutarsiz.length}  ⚠`)
    console.log(`  Bir tezgaha ÇOK kaynak              : ${cokluKaynak.length}`)
    console.log(`  IFS'te olup bizde OLMAYAN kaynak    : ${eslesmeyenKaynak.length}`)

    if (tutarsiz.length) {
      console.log('\n═══ ⚠ DOLU AMA YANLIŞ (en tehlikeli — sessizce yanlış IFS kaydına yazar) ═══')
      for (const x of tutarsiz) console.log(`  ${x.kod.padEnd(10)} ${x.alan.padEnd(16)} bizde=${x.bizde}  IFS=${x.ifs}`)
    }

    if (doluAmaEslesmeyen.length) {
      console.log("\n═══ ⚠ BİZDE DOLU, IFS'TE KARŞILIĞI YOK ═══")
      for (const t of doluAmaEslesmeyen) {
        console.log(`  ${t.kod.padEnd(10)} rid=${t.ifsResourceId ?? '—'} wc=${t.ifsWorkCenterNo ?? '—'}  ${t.ad.slice(0, 34)}`)
      }
    }

    if (bulunamadi.length) {
      console.log(`\n═══ IFS'TE BULUNAMAYAN TEZGAHLAR (${bulunamadi.length}) ═══`)
      const aktifYok = bulunamadi.filter((t) => t.aktif)
      const pasifYok = bulunamadi.filter((t) => !t.aktif)
      console.log(`  aktif: ${aktifYok.length} · pasif: ${pasifYok.length}`)
      for (const t of aktifYok.slice(0, 40)) console.log(`  [aktif] ${t.kod.padEnd(10)} ${t.ad.slice(0, 44)}`)
      if (aktifYok.length > 40) console.log(`  … +${aktifYok.length - 40}`)
    }

    if (cokluKaynak.length) {
      console.log(`\n═══ ÇOK KAYNAKLI TEZGAHLAR (${cokluKaynak.length}) ═══`)
      for (const c of cokluKaynak.slice(0, 20)) {
        console.log(`  ${c.kod}: ${c.kaynaklar.map((r) => `${r.rid}(wc ${r.wc})`).join(', ')}`)
      }
    }

    if (eslesmeyenKaynak.length) {
      console.log(`\n═══ IFS'TE OLUP BİZDE OLMAYAN KAYNAKLAR (${eslesmeyenKaynak.length}) ═══`)
      for (const r of eslesmeyenKaynak.slice(0, 40)) {
        console.log(`  ${r.rid.padEnd(10)} wc=${(r.wc || '—').padEnd(6)} ${r.desc.slice(0, 50)}`)
      }
      if (eslesmeyenKaynak.length > 40) console.log(`  … +${eslesmeyenKaynak.length - 40}`)
    }

    if (bosAlanli.length) {
      console.log(`\n═══ EŞLEŞTİ AMA ALANI BOŞ (${bosAlanli.length}) — backfill bunları doldurur ═══`)
      for (const t of bosAlanli.slice(0, 30)) {
        const r = byKod.get(t.kod)![0]
        console.log(`  ${t.kod.padEnd(10)} → rid=${r.rid} wc=${r.wc}`)
      }
      if (bosAlanli.length > 30) console.log(`  … +${bosAlanli.length - 30}`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(String(e).slice(0, 300))
  process.exit(1)
})
