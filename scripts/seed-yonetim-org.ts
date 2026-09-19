/**
 * Hub org şemasına "Yönetim" kutusu — kökün (ORG-TF) hemen altında, müdürlüklerle aynı düzeyde
 * DEPARTMENT; içinde iki koltuk: Genel Müdür (ILR-0001) ve Genel Müdür Yardımcısı (ILR-0002).
 *
 *   npx tsx scripts/seed-yonetim-org.ts            → DRY-RUN (yazmaz, ne olacağını basar)
 *   npx tsx scripts/seed-yonetim-org.ts --apply    → tek transaction içinde uygular
 *
 * NEDEN: IFS personel senkronu kişinin bölümünü DepartmentDefinition.orgUnitId → şema kutusundan
 * çözer; "GENEL MÜDÜRLÜK" bölümünün kutusu olmadığı için ILR-0001/0002 hep ATLA kalıyordu
 * (bkz. src/lib/ifs/personel-sync/plan.ts, "bölümün şema kutusu yok").
 *
 * KOD DÜZENİ: canlı ağaç ORG-TF-P#### (müdürlük ve koltuklar aynı sayı dizisini paylaşır,
 * ör. P0001 İV Müdürlüğü → P0002 İV Müdürü). Sıradaki üç numara alınır: dept, GM, GMY.
 * IFS kodu bu koddan türer (hubKodundanIfsKodu: ORG-TF-P0123 → P0123).
 *
 * DOKUNULMAYANLAR (bilerek):
 *  - ORG-TF-GM / ORG-TF-GMY kök altındaki mevcut koltuklar ve içindeki OrgEmployee satırları
 *    KALIR: org şemasının raporlama hattı (müdürlükler GMY'nin altında) ve deneme değerlendirme
 *    muafiyeti (deneme-zincir MUAF_POZISYON_KODLARI = ORG-TF-GM/GMY) bunlara bağlı. Kişi iki
 *    koltuklu olur; senkronun koltuk seçimi (18.09) Personnel.bolum'un kutusu altındaki koltuğu
 *    tercih ettiği için IFS'te Yönetim koltuğu kullanılır.
 *  - User.department metni ('Genel Müdürlük', 1 satır) — AD'den gelir, elle yazılmaz.
 *  - ArsivBolum.ad 'GENEL MÜDÜRLÜK' — DepartmentDefinition.arsivBolumId FK ile bağlı, ad
 *    eşleşmesi kullanılmıyor (31.08 onarımı), görüntü metni olarak kalır.
 *
 * İdempotent: her adım "varsa atla" — kutu adıyla (üst=kök, ad='Yönetim'), koltuk adıyla,
 * OrgEmployee (orgUnitId + personnelId) ile, DepartmentDefinition adıyla bulunur.
 */
import 'dotenv/config'
import { PrismaClient, OrgUnitType, OrgPositionStatus } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const APPLY = process.argv.includes('--apply')
const KOK_KOD = 'ORG-TF'
const ESKI_BOLUM = 'GENEL MÜDÜRLÜK'
const YENI_BOLUM = 'Yönetim'
const KOLTUKLAR = [
  { ad: 'Genel Müdür', sicil: 'ILR-0001', ustAd: null as string | null },
  { ad: 'Genel Müdür Yardımcısı', sicil: 'ILR-0002', ustAd: 'Genel Müdür' },
]

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const baslikHali = (s: string) => s.trim().toLocaleLowerCase('tr-TR').split(/\s+/).map((k) => k.charAt(0).toLocaleUpperCase('tr-TR') + k.slice(1)).join(' ')

interface Adim { ne: string; detay: string }

async function main() {
  const plan: Adim[] = []
  const kok = await prisma.orgUnit.findUnique({ where: { code: KOK_KOD }, select: { id: true, level: true } })
  if (!kok) throw new Error(`kök kutu ${KOK_KOD} yok`)

  // Sıradaki P#### numaraları (mevcut en büyük + 1..3; varsa mevcut kodlar korunur)
  const kodlar = await prisma.orgUnit.findMany({ where: { code: { startsWith: `${KOK_KOD}-P` } }, select: { code: true } })
  let siradaki = Math.max(0, ...kodlar.map((k) => Number(/^ORG-TF-P(\d{4})$/.exec(k.code)?.[1] ?? '0'))) + 1
  const yeniKod = () => `${KOK_KOD}-P${String(siradaki++).padStart(4, '0')}`

  // 1) Yönetim kutusu
  let dept = await prisma.orgUnit.findFirst({ where: { parentId: kok.id, unitType: OrgUnitType.DEPARTMENT, name: YENI_BOLUM }, select: { id: true, code: true, level: true, isActive: true } })
  const kardesSira = await prisma.orgUnit.count({ where: { parentId: kok.id } })
  const deptKod = dept?.code ?? yeniKod()
  if (dept) plan.push({ ne: 'OrgUnit VAR', detay: `${dept.code} ${YENI_BOLUM} (dokunulmaz${dept.isActive ? '' : ' — PASİF!'})` })
  else plan.push({ ne: 'OrgUnit CREATE', detay: `${deptKod} "${YENI_BOLUM}" DEPARTMENT, üst=${KOK_KOD}, level=${kok.level + 1}, sortOrder=${kardesSira} → IFS ORG ${deptKod.slice(KOK_KOD.length + 1)}` })

  // 2) Koltuklar
  const koltukKod = new Map<string, string>()
  const koltukVar = new Map<string, { id: string; code: string }>()
  if (dept) for (const k of KOLTUKLAR) {
    const u = await prisma.orgUnit.findFirst({ where: { unitType: OrgUnitType.POSITION, name: k.ad, OR: [{ parentId: dept.id }, { parent: { parentId: dept.id } }] }, select: { id: true, code: true } })
    if (u) koltukVar.set(k.ad, u)
  }
  for (const k of KOLTUKLAR) {
    const v = koltukVar.get(k.ad); const kod = v?.code ?? yeniKod(); koltukKod.set(k.ad, kod)
    if (v) plan.push({ ne: 'OrgUnit VAR', detay: `${v.code} ${k.ad}` })
    else plan.push({ ne: 'OrgUnit CREATE', detay: `${kod} "${k.ad}" POSITION, üst=${k.ustAd ? koltukKod.get(k.ustAd) : deptKod} → IFS POZISYON ${kod.slice(KOK_KOD.length + 1)}` })
  }

  // 3) Kişiler → OrgEmployee
  const kisiler = await prisma.personnel.findMany({ where: { sicilNo: { in: KOLTUKLAR.map((k) => k.sicil) } }, select: { id: true, sicilNo: true, adSoyad: true, aktif: true, bolum: true, departmentId: true } })
  const kisiBySicil = new Map(kisiler.map((p) => [p.sicilNo, p]))
  for (const k of KOLTUKLAR) {
    const p = kisiBySicil.get(k.sicil)
    if (!p) { plan.push({ ne: 'HATA', detay: `${k.sicil} Personnel'de yok` }); continue }
    if (!p.aktif) plan.push({ ne: 'UYARI', detay: `${k.sicil} pasif` })
    const v = koltukVar.get(k.ad)
    const mevcut = v ? await prisma.orgEmployee.findFirst({ where: { orgUnitId: v.id, personnelId: p.id, isActive: true }, select: { id: true } }) : null
    const digerKoltuklar = await prisma.orgEmployee.findMany({ where: { personnelId: p.id, isActive: true }, select: { orgUnit: { select: { code: true, name: true } } } })
    plan.push({
      ne: mevcut ? 'OrgEmployee VAR' : 'OrgEmployee CREATE',
      detay: `${k.sicil} ${baslikHali(p.adSoyad)} → ${koltukKod.get(k.ad)} "${k.ad}" (positionTitle="${k.ad}", personnelId bağlı)` +
        (digerKoltuklar.length ? ` · diğer koltukları KALIR: ${digerKoltuklar.map((d) => d.orgUnit.code).join(', ')}` : ''),
    })
  }

  // 4) DepartmentDefinition: GENEL MÜDÜRLÜK → Yönetim + orgUnitId
  const eskiDept = await prisma.departmentDefinition.findFirst({ where: { name: ESKI_BOLUM }, select: { id: true, orgUnitId: true, isActive: true } })
  const yeniDept = await prisma.departmentDefinition.findFirst({ where: { name: YENI_BOLUM }, select: { id: true, orgUnitId: true } })
  let deptDefId: string | null = null
  if (yeniDept) { deptDefId = yeniDept.id; plan.push({ ne: 'DepartmentDefinition VAR', detay: `"${YENI_BOLUM}" (${yeniDept.id}) orgUnitId=${yeniDept.orgUnitId ?? 'NULL → bağlanacak'}` }) }
  else if (eskiDept) { deptDefId = eskiDept.id; plan.push({ ne: 'DepartmentDefinition UPDATE', detay: `"${ESKI_BOLUM}" (${eskiDept.id}) → name="${YENI_BOLUM}", orgUnitId=${deptKod}` }) }
  else plan.push({ ne: 'DepartmentDefinition CREATE', detay: `"${YENI_BOLUM}" orgUnitId=${deptKod}` })

  // 5) Personnel.bolum metni + departmentId
  const bolumKisiler = await prisma.personnel.findMany({ where: { bolum: ESKI_BOLUM }, select: { id: true, sicilNo: true, adSoyad: true, departmentId: true, aktif: true } })
  for (const p of bolumKisiler) plan.push({ ne: 'Personnel UPDATE', detay: `${p.sicilNo ?? '(sicilsiz)'} ${baslikHali(p.adSoyad)}${p.aktif ? '' : ' (pasif)'}: bolum "${ESKI_BOLUM}" → "${YENI_BOLUM}"${p.departmentId ? '' : ', departmentId NULL → bağlanacak'}` })

  // Bilgi: dokunulmayan referanslar
  const userDept = await prisma.user.count({ where: { department: { equals: 'Genel Müdürlük', mode: 'insensitive' } } })
  plan.push({ ne: 'BİLGİ', detay: `User.department='Genel Müdürlük' ${userDept} satır — AD kaynaklı, dokunulmaz` })

  console.log(`\n${APPLY ? 'APPLY' : 'DRY-RUN'} — ${process.env.DATABASE_URL?.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@')}\n`)
  for (const a of plan) console.log(`  ${a.ne.padEnd(28)} ${a.detay}`)
  if (plan.some((a) => a.ne === 'HATA')) { console.error('\nHATA var — uygulanmadı'); process.exit(1) }
  if (!APPLY) { console.log('\n(dry-run; --apply ile uygulanır)'); return }

  await prisma.$transaction(async (tx) => {
    const d = dept ?? await tx.orgUnit.create({
      data: { code: deptKod, name: YENI_BOLUM, unitType: OrgUnitType.DEPARTMENT, parentId: kok.id, level: kok.level + 1, sortOrder: kardesSira, approvedHeadcount: null, isExternal: false, positionStatus: OrgPositionStatus.AKTIF, positionId: null, vekaletDurumu: false, isActive: true },
      select: { id: true, code: true, level: true, isActive: true },
    })
    const koltukId = new Map<string, string>()
    for (const [i, k] of KOLTUKLAR.entries()) {
      const v = koltukVar.get(k.ad)
      if (v) { koltukId.set(k.ad, v.id); continue }
      const ustId = k.ustAd ? koltukId.get(k.ustAd)! : d.id
      const ustLevel = k.ustAd ? d.level + 1 : d.level
      const u = await tx.orgUnit.create({
        data: { code: koltukKod.get(k.ad)!, name: k.ad, unitType: OrgUnitType.POSITION, parentId: ustId, level: ustLevel + 1, sortOrder: i, approvedHeadcount: 1, isExternal: false, positionStatus: OrgPositionStatus.AKTIF, positionId: null, vekaletDurumu: false, isActive: true },
        select: { id: true },
      })
      koltukId.set(k.ad, u.id)
    }
    for (const k of KOLTUKLAR) {
      const p = kisiBySicil.get(k.sicil)!
      const uid = koltukId.get(k.ad)!
      const var_ = await tx.orgEmployee.findFirst({ where: { orgUnitId: uid, personnelId: p.id, isActive: true }, select: { id: true } })
      if (!var_) await tx.orgEmployee.create({ data: { orgUnitId: uid, personnelId: p.id, displayName: baslikHali(p.adSoyad), positionTitle: k.ad, employmentStatus: 'ACTIVE', isActive: true } })
    }
    if (yeniDept) { if (!yeniDept.orgUnitId) await tx.departmentDefinition.update({ where: { id: yeniDept.id }, data: { orgUnitId: d.id } }) }
    else if (eskiDept) await tx.departmentDefinition.update({ where: { id: eskiDept.id }, data: { name: YENI_BOLUM, orgUnitId: d.id } })
    else { const c = await tx.departmentDefinition.create({ data: { name: YENI_BOLUM, orgUnitId: d.id, isActive: true }, select: { id: true } }); deptDefId = c.id }
    for (const p of bolumKisiler) await tx.personnel.update({ where: { id: p.id }, data: { bolum: YENI_BOLUM, ...(p.departmentId ? {} : deptDefId ? { departmentId: deptDefId } : {}) } })
  })
  console.log('\nUYGULANDI')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
