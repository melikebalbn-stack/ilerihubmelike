/**
 * TEK SEFERLİK — IFS org/pozisyon ValidFrom toplu geriye çekme (→ 2000-01-01).
 *
 * NEDEN: org/pozisyon geçerlilik penceresi personelin işe giriş tarihinden SONRA
 * başlıyorsa IFS employee create'i reddediyor (ORGCODENOTVALID / NOTVALID).
 * Personel senkronunun (ifs-personel-sync) çalışabilmesi için pencereler açılmalı.
 *
 * GÜVENLİK:
 *  - Yalnız IFS **test** ortamı (host 'ifscloudtest' içermeli) → aksi halde DUR.
 *  - Yalnız **ValidFrom** alanı PATCH'lenir; başka alana dokunulmaz.
 *  - Varsayılan salt okuma. Yazmak için açıkça --apply.
 *
 *   npx tsx --env-file=/home/rokunet/projects/ilerihub-terminal/.env --env-file=.env \
 *     scripts/ipro/fix-ifs-gecerlilik.ts <--kesif|--dry-run|--apply|--dogrula> [--pozisyon]
 *   (NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem gerekli)
 */
const HEDEF_TARIH = '2000-01-01'

const MOD = process.argv.find((a) => ['--kesif', '--kesif-tip', '--sonda', '--sonda2', '--yetki', '--ara', '--orgset', '--org2', '--alan', '--tekyaz', '--dry-run', '--apply', '--dogrula'].includes(a))
const TIP_ARG = process.argv[process.argv.indexOf('--kesif-tip') + 1]
const POZISYON = process.argv.includes('--pozisyon')
const TEK = process.argv.includes('--tek') ? process.argv[process.argv.indexOf('--tek') + 1] : null

// ── altyapı ──────────────────────────────────────────────────────────────

let tokenCache: { t: string; exp: number } | null = null

async function token(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.t
  const b = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.IFS_CLIENT_ID!,
    client_secret: process.env.IFS_CLIENT_SECRET!,
  })
  if (process.env.IFS_SCOPE) b.set('scope', process.env.IFS_SCOPE)
  const r = await fetch(process.env.IFS_TOKEN_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: b,
  })
  if (!r.ok) throw new Error(`token HTTP ${r.status}`)
  const j = await r.json()
  tokenCache = { t: j.access_token, exp: Date.now() + 120_000 }
  return j.access_token
}

function mainRoot(): string {
  return process.env
    .IFS_INT_BASE_URL!.replace(/\/+$/, '')
    .replace(/[A-Za-z]+\.svc$/, '')
    .replace('/int/', '/main/')
}

type Cevap = { status: number; body: any; etag: string | null; text: string }

async function istek(yol: string, init: RequestInit = {}): Promise<Cevap> {
  const r = await fetch(`${mainRoot()}${yol}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await token()}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await r.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* metin */
  }
  const govde = body?.['@odata.etag']
  return { status: r.status, body, etag: r.headers.get('etag') ?? (typeof govde === 'string' ? govde : null), text }
}

function hataMesaji(c: Cevap): string {
  return c.body?.error?.details?.[0]?.message ?? c.body?.error?.message ?? c.text.slice(0, 200)
}

const COMPANY = process.env.IFS_COMPANY ?? 'ILERI2'

// ── ADIM 1: keşif ────────────────────────────────────────────────────────

const ADAY_PROJEKSIYONLAR = [
  'OrganizationStructuresHandling',
  'OrganizationStructures',
  'OrganizationStructureHandling',
  'OrganizationHandling',
  'EmployeesHandling',
]

async function kesif() {
  console.log('=== Projeksiyon adayları ($metadata) ===\n')
  for (const p of ADAY_PROJEKSIYONLAR) {
    const r = await istek(`${p}.svc/$metadata`)
    if (r.status !== 200) {
      console.log(`  ${p.padEnd(34)} HTTP ${r.status} ✗`)
      continue
    }
    // OData 4.01 JSON CSDL: { "IfsApp.<Proj>": { "<Tip>": {$Kind:"EntityType", ...},
    //                          "<Container>": {$Kind:"EntityContainer", "<Set>": {$Type:...}}}
    console.log(`\n── ${p} — HTTP 200 ✓`)
    const ns = r.body?.[`IfsApp.${p}`] ?? {}

    const validFromTipler = Object.entries(ns)
      .filter(([, v]: [string, any]) => v?.$Kind === 'EntityType' && v?.ValidFrom)
      .map(([ad]) => ad)
    console.log(`   ValidFrom taşıyan EntityType (${validFromTipler.length}): ${validFromTipler.join(', ') || '(yok)'}`)

    const kap = Object.values(ns).find((v: any) => v?.$Kind === 'EntityContainer') as any
    const setler = Object.entries(kap ?? {})
      .filter(([, v]: [string, any]) => typeof v === 'object' && v?.$Type)
      .map(([ad, v]: [string, any]) => ({ ad, tip: String(v.$Type).split('.').pop()! }))
    const ilgili = setler.filter((s) => validFromTipler.includes(s.tip))
    console.log(`   → ValidFrom taşıyan EntitySet (${ilgili.length}): ${ilgili.map((s) => `${s.ad}(${s.tip})`).join(', ') || '(yok)'}`)
  }
}

/** Bir EntityType'ın anahtarını, ValidFrom'unu ve nereden erişilebildiğini dök. */
async function kesifTip(tipAdi: string) {
  for (const p of ['OrganizationStructuresHandling', 'EmployeesHandling', 'PositionsHandling']) {
    const r = await istek(`${p}.svc/$metadata`)
    if (r.status !== 200) continue
    const ns = r.body?.[`IfsApp.${p}`] ?? {}
    const tip = ns[tipAdi]
    if (!tip) {
      console.log(`\n── ${p}: ${tipAdi} YOK`)
      continue
    }
    console.log(`\n── ${p}.${tipAdi}`)
    console.log(`   $Key: ${JSON.stringify(tip.$Key)}`)
    console.log(`   ValidFrom: ${JSON.stringify(tip.ValidFrom)}`)
    console.log(`   Alanlar: ${Object.keys(tip).filter((k) => !k.startsWith('$')).join(', ').slice(0, 400)}`)

    // Bu tipe giden EntitySet ya da NavigationProperty var mı?
    const kap = Object.values(ns).find((v: any) => v?.$Kind === 'EntityContainer') as any
    const setler = Object.entries(kap ?? {})
      .filter(([, v]: [string, any]) => String(v?.$Type ?? '').endsWith(`.${tipAdi}`))
      .map(([ad]) => ad)
    console.log(`   Doğrudan EntitySet: ${setler.join(', ') || '(yok)'}`)

    const navlar: string[] = []
    for (const [sahip, tanim] of Object.entries(ns)) {
      if ((tanim as any)?.$Kind !== 'EntityType') continue
      for (const [alan, v] of Object.entries(tanim as any)) {
        const vv = v as any
        if (vv?.$Kind === 'NavigationProperty' && String(vv.$Type ?? '').endsWith(`.${tipAdi}`)) {
          navlar.push(`${sahip}.${alan}${vv.$Collection ? '[]' : ''}`)
        }
      }
    }
    console.log(`   Navigasyon: ${navlar.join(', ') || '(yok)'}`)
  }
}

// ── org okuma ────────────────────────────────────────────────────────────

/**
 * YAZILABİLİR org yüzeyi. Aurena'nın kullandığı set (Network yakalaması).
 * DİKKAT: anahtarda OrgCode YOK — (BusinessUnitId, StructType, RelationId).
 * Geçerlilik alanı da ValidFrom değil **OrgValidFrom**.
 * EmployeesHandling/OrganizationSet ve tüm `Lov` / `Reference_` set'leri salt
 * okunur (PATCH → HTTP 500); tek yazılabilir yol budur.
 */

type Org = {
  OrgCode: string
  OrgName: string
  OrgValidFrom: string
  BusinessUnitId: number
  StructType: string
  RelationId: number
}

async function orgListesi(): Promise<Org[]> {
  const r = await istek(`${ORG2_YOL}?$top=500`)
  if (r.status !== 200) throw new Error(`org listesi HTTP ${r.status}: ${hataMesaji(r)}`)
  return r.body.value
}

// ── pozisyon okuma ───────────────────────────────────────────────────────

type Poz = { CompanyId: string; PosCode: string; PositionTitle: string; ValidFrom: string }

const POZ_YOL = 'PositionsHandling.svc/CompanyPositionStrs'

async function pozListesi(): Promise<Poz[]> {
  const f = encodeURIComponent(`CompanyId eq '${COMPANY}'`)
  const r = await istek(`${POZ_YOL}?$filter=${f}&$top=1000`)
  if (r.status !== 200) throw new Error(`pozisyon listesi HTTP ${r.status}: ${hataMesaji(r)}`)
  return r.body.value
}

function pozAnahtar(p: Poz): string {
  return `(CompanyId='${COMPANY}',PosCode='${p.PosCode}')`
}

// ── ortak: dry-run / apply / doğrula ─────────────────────────────────────

type Kayit = { kod: string; ad: string; validFrom: string; anahtar: string }

async function kayitlar(): Promise<{ yol: string; tur: string; alan: string; hepsi: Kayit[] }> {
  if (POZISYON) {
    const l = await pozListesi()
    return {
      yol: POZ_YOL,
      tur: 'pozisyon',
      alan: 'ValidFrom',
      hepsi: l.map((p) => ({ kod: p.PosCode, ad: p.PositionTitle ?? '', validFrom: (p.ValidFrom ?? '').slice(0, 10), anahtar: pozAnahtar(p) })),
    }
  }
  const l = await orgListesi()
  return {
    yol: ORG2_YOL,
    tur: 'org',
    alan: 'OrgValidFrom',
    hepsi: l
      .map((o) => ({ kod: o.OrgCode, ad: o.OrgName ?? '', validFrom: (o.OrgValidFrom ?? '').slice(0, 10), anahtar: org2Anahtar(o) }))
      .sort((a, b) => a.kod.localeCompare(b.kod)),
  }
}

async function dryRun() {
  const { tur, hepsi } = await kayitlar()
  const hedef = hepsi.filter((k) => k.validFrom !== HEDEF_TARIH)

  console.log(`=== ${tur.toUpperCase()} — toplam ${hepsi.length}, PATCH gerekli ${hedef.length} ===\n`)
  const dagilim: Record<string, number> = {}
  for (const k of hepsi) dagilim[k.validFrom || '(boş)'] = (dagilim[k.validFrom || '(boş)'] ?? 0) + 1
  console.log('ValidFrom dağılımı:', dagilim, '\n')

  for (const k of hedef) {
    console.log(`  ${k.kod.padEnd(10)} ${k.ad.slice(0, 42).padEnd(44)} ${k.validFrom} → ${HEDEF_TARIH}`)
  }
  const atlanan = hepsi.filter((k) => k.validFrom === HEDEF_TARIH)
  if (atlanan.length) console.log(`\nZaten ${HEDEF_TARIH} (atlanacak): ${atlanan.map((a) => a.kod).join(', ')}`)
}

async function apply() {
  const { yol, tur, alan, hepsi } = await kayitlar()
  let hedef = hepsi.filter((k) => k.validFrom !== HEDEF_TARIH)
  if (TEK) hedef = hedef.filter((k) => k.kod === TEK) // tek kayıtlık PATCH desteği sondası
  console.log(`=== ${tur.toUpperCase()} PATCH — ${hedef.length} kayıt ===\n`)

  let ok = 0
  const hatalar: Array<{ kod: string; detay: string }> = []

  for (const k of hedef) {
    try {
      // Bound action değil ama PATCH da durum değiştirir → If-Match zorunlu olabilir.
      const oku = await istek(`${yol}${k.anahtar}`)
      if (oku.status !== 200) throw new Error(`GET HTTP ${oku.status}: ${hataMesaji(oku)}`)

      const r = await istek(`${yol}${k.anahtar}`, {
        method: 'PATCH',
        body: JSON.stringify({ [alan]: HEDEF_TARIH }), // YALNIZ geçerlilik alanı
        headers: oku.etag ? { 'If-Match': oku.etag } : {},
      })
      if (r.status >= 400) throw new Error(`PATCH HTTP ${r.status}: ${hataMesaji(r)}`)

      ok++
      console.log(`  ✓ ${k.kod.padEnd(10)} ${k.validFrom} → ${HEDEF_TARIH}`)
    } catch (e) {
      const detay = (e as Error).message
      hatalar.push({ kod: k.kod, detay })
      console.log(`  ✗ ${k.kod.padEnd(10)} ${detay}`) // atla, koşuyu kırma
    }
  }

  console.log(`\nBaşarılı: ${ok}/${hedef.length}`)
  if (hatalar.length) {
    console.log(`Hatalı: ${hatalar.length}`)
    for (const h of hatalar) console.log(`  ${h.kod}: ${h.detay}`)
  }
}

async function dogrula() {
  const { tur, hepsi } = await kayitlar()
  const uygun = hepsi.filter((k) => k.validFrom === HEDEF_TARIH)
  console.log(`=== ${tur.toUpperCase()} DOĞRULAMA ===`)
  console.log(`ValidFrom=${HEDEF_TARIH} olan: ${uygun.length}/${hepsi.length}`)
  const kalan = hepsi.filter((k) => k.validFrom !== HEDEF_TARIH)
  if (kalan.length) for (const k of kalan) console.log(`  KALAN ${k.kod.padEnd(10)} ${k.validFrom}`)
  else console.log('Tamamı hedef tarihte ✓')
}

// ── giriş ────────────────────────────────────────────────────────────────

/** Aday yazma yollarını tek org üzerinde sırayla dener (salt teşhis). */
async function sondaYaz() {
  const adaylar = [
    { yol: 'OrganizationStructuresHandling.svc/CompanyOrgStructures', anahtarAlan: 'ValidDate' },
    { yol: 'OrganizationStructuresHandling.svc/OrganizationSet', anahtarAlan: null },
    { yol: 'EmployeesHandling.svc/Reference_LovCompanyOrg', anahtarAlan: null },
  ]
  for (const a of adaylar) {
    const liste = await istek(`${a.yol}?$filter=${encodeURIComponent(`CompanyId eq '${COMPANY}' and OrgCode eq '100'`)}&$top=3`)
    console.log(`\n── ${a.yol}`)
    console.log(`   GET liste: HTTP ${liste.status}${liste.status === 200 ? ` (${liste.body?.value?.length ?? 0} kayıt)` : ` — ${hataMesaji(liste)}`}`)
    if (liste.status !== 200 || !liste.body?.value?.length) continue
    const k = liste.body.value[0]
    console.log(`   örnek: ${JSON.stringify(k).slice(0, 220)}`)
    const anahtar = a.anahtarAlan
      ? `(CompanyId='${COMPANY}',OrgCode='100',${a.anahtarAlan}=${k[a.anahtarAlan]})`
      : `(CompanyId='${COMPANY}',OrgCode='100')`
    const oku = await istek(`${a.yol}${anahtar}`)
    console.log(`   GET tekil ${anahtar}: HTTP ${oku.status}`)
    if (oku.status !== 200) continue
    const pr = await istek(`${a.yol}${anahtar}`, {
      method: 'PATCH',
      body: JSON.stringify({ ValidFrom: HEDEF_TARIH }),
      headers: oku.etag ? { 'If-Match': oku.etag } : {},
    })
    console.log(`   PATCH ValidFrom: HTTP ${pr.status}${pr.status >= 400 ? ` — ${hataMesaji(pr)}` : '  ✓ YAZILABİLİR'}`)
  }
}

/** 403 kapsamı: projeksiyonun tamamı mı, tek tek set'ler mi? */
async function yetkiTeshis() {
  const setler = [
    'OrganizationStructuresHandling.svc/CompanyOrgStructures',
    'OrganizationStructuresHandling.svc/OrganizationSet',
    'OrganizationStructuresHandling.svc/Structures',
    'OrganizationStructuresHandling.svc/Reference_CompanyOrgStructure',
    'OrganizationStructuresHandling.svc/CompanyPersAssignSet',
    'EmployeesHandling.svc/OrganizationSet',
    'PositionsHandling.svc/CompanyPositionStrs',
  ]
  for (const y of setler) {
    const r = await istek(`${y}?$top=1`)
    console.log(`  ${r.status === 200 ? '✓' : '✗'} HTTP ${String(r.status).padEnd(4)} ${y}${r.status !== 200 ? `  — ${hataMesaji(r)}` : ''}`)
  }
}

/** OrganizationStructuresHandling: action envanteri + CompanyOrgStructures dogru anahtar. */
async function sonda2() {
  const r = await istek('OrganizationStructuresHandling.svc/$metadata')
  const ns = r.body?.['IfsApp.OrganizationStructuresHandling'] ?? {}

  console.log('=== Action / Function envanteri ===')
  for (const [ad, tanim] of Object.entries(ns)) {
    const t: any = Array.isArray(tanim) ? tanim[0] : tanim
    if (t?.$Kind !== 'Action' && t?.$Kind !== 'Function') continue
    const bound = t.$IsBound ? 'BOUND' : 'unbound'
    const par = (t.$Parameter ?? []).map((x: any) => `${x.$Name}:${String(x.$Type ?? 'Edm.String').split('.').pop()}`).join(', ')
    console.log(`  ${bound.padEnd(8)} ${ad}(${par})`)
  }

  console.log('\n=== CompanyOrgStructures — dogru anahtar denemeleri ===')
  const liste = await istek(`OrganizationStructuresHandling.svc/CompanyOrgStructures?$filter=${encodeURIComponent("CompanyId eq 'ILERI2' and OrgCode eq '100'")}&$top=1`)
  const k: any = liste.body?.value?.[0]
  console.log(`  ham ValidDate: ${JSON.stringify(k?.ValidDate)}  | ValidFrom: ${JSON.stringify(k?.ValidFrom)}`)
  const adaylar = [k?.ValidDate, String(k?.ValidDate ?? '').replace('Z', ''), `${String(k?.ValidDate ?? '').slice(0, 19)}Z`]
  for (const v of adaylar.filter(Boolean)) {
    const anahtar = `(CompanyId='ILERI2',OrgCode='100',ValidDate=${v})`
    const g = await istek(`OrganizationStructuresHandling.svc/CompanyOrgStructures${anahtar}`)
    console.log(`  GET ${anahtar} -> HTTP ${g.status}`)
    if (g.status !== 200) continue
    const pr = await istek(`OrganizationStructuresHandling.svc/CompanyOrgStructures${anahtar}`, {
      method: 'PATCH', body: JSON.stringify({ ValidFrom: HEDEF_TARIH }),
      headers: g.etag ? { 'If-Match': g.etag } : {},
    })
    console.log(`  PATCH -> HTTP ${pr.status}${pr.status >= 400 ? ` — ${hataMesaji(pr)}` : '  ✓ YAZILABILIR'}`)
    break
  }
}

/** CompanyOrg'u YAZILABILIR EntitySet olarak sunan projeksiyonu ara. */
async function projeksiyonAra() {
  const adaylar = [
    'CompanyOrganizationsHandling', 'CompanyOrganizationHandling', 'OrganizationBasicDataHandling',
    'CompanyOrgHandling', 'OrganizationDetailsHandling', 'OrganizationsHandling', 'OrgUnitHandling',
    'CompanyOrganizationStructureHandling', 'EmployeeOrganizationHandling', 'CompanyBasicDataHandling',
    'OrganizationChartHandling', 'CompanyOrganizationBasicHandling', 'HcmBasicDataHandling',
    'OrganizationStructuresHandling', 'EmployeesHandling', 'PositionsHandling',
  ]
  for (const p of adaylar) {
    const r = await istek(`${p}.svc/$metadata`)
    if (r.status !== 200) { console.log(`  ✗ ${String(r.status)} ${p}`); continue }
    const ns = r.body?.[`IfsApp.${p}`] ?? {}
    const kap: any = Object.values(ns).find((v: any) => v?.$Kind === 'EntityContainer')
    // CompanyOrg tipini sunan EntitySet'ler (Lov* olmayanlar oncelikli)
    const setler = Object.entries(kap ?? {})
      .filter(([, v]: [string, any]) => /\.CompanyOrg$/.test(String(v?.$Type ?? '')))
      .map(([ad]) => ad)
    console.log(`  ✓ 200 ${p.padEnd(38)} CompanyOrg set: ${setler.join(', ') || '(yok)'}`)
    for (const set of setler) {
      const g = await istek(`${p}.svc/${set}(CompanyId='ILERI2',OrgCode='100')`)
      if (g.status !== 200) { console.log(`        ${set}: GET ${g.status}`); continue }
      const pr = await istek(`${p}.svc/${set}(CompanyId='ILERI2',OrgCode='100')`, {
        method: 'PATCH', body: JSON.stringify({ ValidFrom: HEDEF_TARIH }),
        headers: g.etag ? { 'If-Match': g.etag } : {},
      })
      console.log(`        ${set}: GET 200, PATCH ${pr.status}${pr.status >= 400 ? ` — ${hataMesaji(pr)}` : '  ✓✓ YAZILABILIR'}`)
    }
  }
}

/** Erisilebilir projeksiyonlarda anahtarinda OrgCode gecen TUM set'ler + PATCH sondasi. */
async function orgSetTara() {
  for (const p of ['OrganizationStructuresHandling', 'OrganizationChartHandling', 'EmployeesHandling', 'PositionsHandling']) {
    const r = await istek(`${p}.svc/$metadata`)
    if (r.status !== 200) continue
    const ns = r.body?.[`IfsApp.${p}`] ?? {}
    const kap: any = Object.values(ns).find((v: any) => v?.$Kind === 'EntityContainer')
    console.log(`\n── ${p}`)
    for (const [setAdi, v] of Object.entries(kap ?? {})) {
      const tipAdi = String((v as any)?.$Type ?? '').split('.').pop()
      if (!tipAdi) continue
      const tip: any = ns[tipAdi]
      const key: string[] = tip?.$Key ?? []
      if (!key.includes('OrgCode') || !tip?.ValidFrom) continue
      console.log(`   ${setAdi} (${tipAdi}) key=${JSON.stringify(key)}`)
      if (key.length !== 2) { console.log(`      → cok-anahtarli, atlandi`); continue }
      const g = await istek(`${p}.svc/${setAdi}(CompanyId='ILERI2',OrgCode='100')`)
      if (g.status !== 200) { console.log(`      GET ${g.status}`); continue }
      const pr = await istek(`${p}.svc/${setAdi}(CompanyId='ILERI2',OrgCode='100')`, {
        method: 'PATCH', body: JSON.stringify({ ValidFrom: HEDEF_TARIH }),
        headers: g.etag ? { 'If-Match': g.etag } : {},
      })
      console.log(`      GET 200, PATCH ${pr.status}${pr.status >= 400 ? ` — ${hataMesaji(pr)}` : '  ✓✓ YAZILABILIR'}`)
    }
  }
}

/** Organizations set'i — Aurena'nin gercek yazma yuzeyi (Network yakalamasi). */
async function orgListe2() {
  const meta = await istek('OrganizationStructuresHandling.svc/$metadata')
  const ns = meta.body?.['IfsApp.OrganizationStructuresHandling'] ?? {}
  const kap: any = Object.values(ns).find((v: any) => v?.$Kind === 'EntityContainer')
  const tipAdi = String(kap?.Organizations?.$Type ?? '').split('.').pop()
  const tip: any = ns[tipAdi ?? '']
  console.log(`Organizations → ${tipAdi}  key=${JSON.stringify(tip?.$Key)}`)
  console.log(`Alanlar: ${Object.keys(tip ?? {}).filter((k) => !k.startsWith('$')).join(', ')}\n`)

  const r = await istek(`OrganizationStructuresHandling.svc/Organizations?$top=200`)
  console.log(`GET liste: HTTP ${r.status}${r.status !== 200 ? ` — ${hataMesaji(r)}` : ''}`)
  if (r.status !== 200) return
  const v: any[] = r.body.value ?? []
  console.log(`Kayit: ${v.length}\n`)
  const dag: Record<string, number> = {}
  for (const o of v) {
    const d = String(o.OrgValidFrom ?? '(null)').slice(0, 10)
    dag[d] = (dag[d] ?? 0) + 1
  }
  console.log('OrgValidFrom dagilimi:', dag, '\n')
  for (const o of v.slice(0, 40)) {
    console.log(`  ${String(o.OrgCode).padEnd(6)} ${String(o.OrgName ?? '').slice(0,34).padEnd(36)} BU=${String(o.BusinessUnitId).padEnd(6)} Rel=${String(o.RelationId).padEnd(5)} ${String(o.OrgValidFrom).slice(0,10)}`)
  }
}

/** Iki set'in geçerlilik alanlarini yan yana koy: hangi alan LOV'a yansiyor? */
async function alanKarsilastir() {
  const a = await istek('OrganizationStructuresHandling.svc/Organizations?$top=200')
  const b = await istek(`EmployeesHandling.svc/OrganizationSet?$filter=${encodeURIComponent("CompanyId eq 'ILERI2'")}&$top=500`)
  const lov = new Map<string, any>((b.body?.value ?? []).map((o: any) => [String(o.OrgCode), o]))
  console.log('OrgCode | Organizations.OrgValidFrom | .OrgStrValidFrom | LOV.ValidFrom')
  for (const o of (a.body?.value ?? []).sort((x: any, y: any) => String(x.OrgCode).localeCompare(String(y.OrgCode)))) {
    const l = lov.get(String(o.OrgCode))
    console.log(`  ${String(o.OrgCode).padEnd(6)} ${String(o.OrgValidFrom).slice(0,10).padEnd(27)} ${String(o.OrgStrValidFrom).slice(0,10).padEnd(17)} ${String(l?.ValidFrom).slice(0,10)}`)
  }
}

const ORG2_YOL = 'OrganizationStructuresHandling.svc/Organizations'
const org2Anahtar = (o: any) => `(BusinessUnitId=${o.BusinessUnitId},StructType='${o.StructType}',RelationId=${o.RelationId})`

/** Tek org uzerinde yazma sondasi (OrgCode ile). */
async function tekYaz(kod: string) {
  const l = await istek(`${ORG2_YOL}?$top=200`)
  const o = (l.body?.value ?? []).find((x: any) => String(x.OrgCode) === kod)
  if (!o) throw new Error(`org ${kod} bulunamadi`)
  const anahtar = org2Anahtar(o)
  console.log(`hedef: ${kod} ${o.OrgName} ${anahtar}`)
  console.log(`once : OrgValidFrom=${String(o.OrgValidFrom).slice(0,10)}`)

  const g = await istek(`${ORG2_YOL}${anahtar}`)
  console.log(`GET tekil: HTTP ${g.status}  etag=${g.etag ? 'var' : 'YOK'}`)
  if (g.status !== 200) { console.log(`  ${hataMesaji(g)}`); return }

  const pr = await istek(`${ORG2_YOL}${anahtar}`, {
    method: 'PATCH', body: JSON.stringify({ OrgValidFrom: HEDEF_TARIH }),
    headers: g.etag ? { 'If-Match': g.etag } : {},
  })
  console.log(`PATCH: HTTP ${pr.status}${pr.status >= 400 ? ` — ${hataMesaji(pr)}` : ''}`)

  const l2 = await istek(`${ORG2_YOL}?$top=200`)
  const o2 = (l2.body?.value ?? []).find((x: any) => String(x.OrgCode) === kod)
  console.log(`sonra: OrgValidFrom=${String(o2?.OrgValidFrom).slice(0,10)}  → ${String(o2?.OrgValidFrom).slice(0,10) === HEDEF_TARIH ? '✓ YAZILDI' : '✗ degismedi'}`)
}

async function main() {
  const host = process.env.IFS_INT_BASE_URL ?? ''
  if (!host.includes('ifscloudtest')) {
    throw new Error(`GÜVENLİK DURDU: IFS host test ortamı değil → ${host.replace(/\/\/.*@/, '//')}`)
  }
  if (!MOD) throw new Error('Mod gerekli: --kesif | --dry-run | --apply | --dogrula  [--pozisyon]')

  if (MOD === '--kesif') return kesif()
  if (MOD === '--tekyaz') return tekYaz(process.argv[process.argv.indexOf('--tekyaz') + 1])
  if (MOD === '--alan') return alanKarsilastir()
  if (MOD === '--org2') return orgListe2()
  if (MOD === '--orgset') return orgSetTara()
  if (MOD === '--ara') return projeksiyonAra()
  if (MOD === '--sonda2') return sonda2()
  if (MOD === '--yetki') return yetkiTeshis()
  if (MOD === '--sonda') return sondaYaz()
  if (MOD === '--kesif-tip') return kesifTip(TIP_ARG)
  if (MOD === '--dry-run') return dryRun()
  if (MOD === '--apply') return apply()
  return dogrula()
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})

export {}
