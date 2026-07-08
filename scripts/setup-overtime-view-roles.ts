/**
 * Mesai salt-görüntüleme permission + rol + atama kurulumu.
 *
 * Kullanım:
 *   npx tsx scripts/setup-overtime-view-roles.ts            # DRY-RUN (hiçbir şey yazmaz)
 *   npx tsx scripts/setup-overtime-view-roles.ts --apply    # DB'ye yazar (idempotent)
 *
 * Yapar:
 *   1) Permission seed: overtime.view.all + overtime.view.dept (yoksa ekle)
 *   2) Rol: "Mesai Görüntüleyici (Tümü)" [view.all] + "Mesai Görüntüleyici (Bölüm)" [view.dept]
 *      (yoksa oluştur, permission'ı bağla)
 *   3) Atama: Ahmet Kara (ad_ahmet.kara) → Tümü rolü.
 *      Bölüm rolü adayları: omurgadaki AKTİF birim sorumluları (DepartmentDefinition
 *      mudur/mudurYardimcisi/sorumlu1-3) → User'a resolve edilip listelenir. Tümü rolü
 *      alanlar bu listeden çıkarılır. --apply ile atanır.
 */
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
dotenv.config()

const APPLY = process.argv.includes('--apply')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const PERMS = [
  { key: 'overtime.view.all', description: 'Mesai/vardiya formlarını salt-okuma görüntüle (TÜM formlar)' },
  { key: 'overtime.view.dept', description: 'Mesai/vardiya formlarını salt-okuma görüntüle (yalnız kendi bölüm(ler)i)' },
]
const ROLES = [
  { slug: 'mesai-goruntuleyici-tumu', name: 'Mesai Görüntüleyici (Tümü)', permKey: 'overtime.view.all', description: 'Tüm mesai/vardiya formlarını salt-okuma görüntüler' },
  { slug: 'mesai-goruntuleyici-bolum', name: 'Mesai Görüntüleyici (Bölüm)', permKey: 'overtime.view.dept', description: 'Kendi bölüm(ler)inin mesai/vardiya formlarını salt-okuma görüntüler' },
]
// Tümü rolü alacak kullanıcılar (User.id)
const TUMU_USER_IDS = ['ad_ahmet.kara']

const log = (...a: unknown[]) => console.log(...a)

async function ensureUserRole(userId: string, roleId: string): Promise<'exists' | 'created' | 'dry'> {
  const existing = await prisma.userRole.findUnique({ where: { userId_roleId: { userId, roleId } } })
  if (existing) return 'exists'
  if (!APPLY) return 'dry'
  await prisma.userRole.create({ data: { userId, roleId, source: 'manual' } })
  return 'created'
}

async function main() {
  log(APPLY ? '🟢 APPLY modu — DB YAZILACAK (idempotent)' : '🟡 DRY-RUN — hiçbir şey yazılmaz (--apply ile uygula)')
  log('─'.repeat(64))

  // ── 1) Permissions ──
  log('\n[1] Permissions')
  const permIdByKey = new Map<string, string>()
  for (const p of PERMS) {
    const existing = await prisma.permission.findUnique({ where: { key: p.key } })
    if (existing) {
      permIdByKey.set(p.key, existing.id)
      log(`  ✓ var:  ${p.key}`)
    } else if (APPLY) {
      const c = await prisma.permission.create({
        data: { key: p.key, module: p.key.split('.')[0], description: p.description, isSystem: true },
      })
      permIdByKey.set(p.key, c.id)
      log(`  + OLUŞTURULDU: ${p.key}`)
    } else {
      log(`  [dry] OLUŞTURULACAK: ${p.key}`)
    }
  }

  // ── 2) Roles + role_permission ──
  log('\n[2] Roller + permission bağlama')
  const roleIdBySlug = new Map<string, string>()
  for (const r of ROLES) {
    let role = await prisma.role.findUnique({ where: { slug: r.slug } })
    if (role) {
      log(`  ✓ rol var: ${r.name}`)
    } else if (APPLY) {
      role = await prisma.role.create({ data: { name: r.name, slug: r.slug, description: r.description, isSystem: false } })
      log(`  + rol OLUŞTURULDU: ${r.name}`)
    } else {
      log(`  [dry] rol OLUŞTURULACAK: ${r.name} (${r.slug})`)
    }
    if (role) roleIdBySlug.set(r.slug, role.id)

    const permId = permIdByKey.get(r.permKey)
    if (role && permId) {
      const rp = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
      })
      if (rp) log(`      ✓ permission bağlı: ${r.permKey}`)
      else if (APPLY) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permId } })
        log(`      + permission BAĞLANDI: ${r.permKey}`)
      } else log(`      [dry] permission BAĞLANACAK: ${r.permKey}`)
    } else {
      log(`      [dry] permission BAĞLANACAK: ${r.permKey} (rol/permission --apply'da oluşacak)`)
    }
  }

  // ── 3a) Tümü ataması ──
  log('\n[3a] "Mesai Görüntüleyici (Tümü)" ataması')
  const tumuRoleId = roleIdBySlug.get('mesai-goruntuleyici-tumu')
  const tumuAssignedUserIds = new Set<string>()
  for (const uid of TUMU_USER_IDS) {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, name: true, email: true } })
    if (!u) { log(`  ! kullanıcı bulunamadı: ${uid} → atlandı`); continue }
    tumuAssignedUserIds.add(u.id)
    if (tumuRoleId) {
      const st = await ensureUserRole(u.id, tumuRoleId)
      log(`  ${st === 'created' ? '+' : st === 'exists' ? '✓' : '[dry]'} ${u.name ?? u.id} (${u.email ?? '-'}) → Tümü [${st}]`)
    } else {
      log(`  [dry] ${u.name ?? u.id} (${u.email ?? '-'}) → Tümü (rol --apply'da oluşacak)`)
    }
  }

  // ── 3b) Bölüm rolü adayları: aktif birim sorumluları → User ──
  log('\n[3b] "Mesai Görüntüleyici (Bölüm)" adayları — aktif birim sorumluları')
  const depts = await prisma.departmentDefinition.findMany({
    where: { isActive: true },
    select: { name: true, mudurId: true, mudurYardimcisiId: true, sorumlu1Id: true, sorumlu2Id: true, sorumlu3Id: true },
  })
  // personnelId → sorumlu olduğu bölüm adları
  const deptsByPersonnel = new Map<string, Set<string>>()
  for (const d of depts) {
    for (const pid of [d.mudurId, d.mudurYardimcisiId, d.sorumlu1Id, d.sorumlu2Id, d.sorumlu3Id]) {
      if (!pid) continue
      if (!deptsByPersonnel.has(pid)) deptsByPersonnel.set(pid, new Set())
      deptsByPersonnel.get(pid)!.add(d.name)
    }
  }
  const persIds = [...deptsByPersonnel.keys()]
  const [persons, users] = await Promise.all([
    prisma.personnel.findMany({ where: { id: { in: persIds } }, select: { id: true, adSoyad: true } }),
    prisma.user.findMany({ where: { personnelId: { in: persIds } }, select: { id: true, name: true, email: true, personnelId: true } }),
  ])
  const adByPersonnel = new Map(persons.map((p) => [p.id, p.adSoyad]))
  const userByPersonnel = new Map(users.map((u) => [u.personnelId as string, u]))

  const bolumRoleId = roleIdBySlug.get('mesai-goruntuleyici-bolum')
  let resolved = 0, unresolvedCnt = 0, skippedTumu = 0
  log('  ── Ad | Bölüm(ler) | User ID | Durum ──')
  for (const pid of persIds) {
    const ad = adByPersonnel.get(pid) ?? '(personel adı yok)'
    const bolumler = [...(deptsByPersonnel.get(pid) ?? [])].join(', ')
    const u = userByPersonnel.get(pid)
    if (!u || !u.email) {
      unresolvedCnt++
      log(`  ✗ ${ad} | ${bolumler} | — | RESOLVE EDİLEMEDİ (User/email yok) → atlanacak`)
      continue
    }
    if (tumuAssignedUserIds.has(u.id)) {
      skippedTumu++
      log(`  ○ ${ad} | ${bolumler} | ${u.id} | Zaten TÜMÜ rolünde → Bölüm listesinden çıkarıldı`)
      continue
    }
    resolved++
    if (bolumRoleId) {
      const st = await ensureUserRole(u.id, bolumRoleId)
      log(`  ${st === 'created' ? '+' : st === 'exists' ? '✓' : '[dry]'} ${ad} | ${bolumler} | ${u.id} | → Bölüm [${st}]`)
    } else {
      log(`  [dry] ${ad} | ${bolumler} | ${u.id} | → Bölüm (rol --apply'da oluşacak)`)
    }
  }

  log('\n' + '─'.repeat(64))
  log(`ÖZET: Tümü=${tumuAssignedUserIds.size} kişi | Bölüm adayı=${resolved} | Tümü nedeniyle atlanan=${skippedTumu} | resolve edilemeyen=${unresolvedCnt}`)
  log(APPLY ? '🟢 APPLY tamamlandı.' : '🟡 DRY-RUN bitti. Listeyi onaylarsan --apply ile uygula.')
}

main()
  .catch((e) => { console.error('HATA:', e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
