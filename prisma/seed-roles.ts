import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { PERMISSION_KEYS } from '../src/lib/auth/permissions'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const P = PERMISSION_KEYS

interface SystemRoleDef {
  slug: string
  name: string
  description: string
  isProtected: boolean
  permissions: string[] | 'ALL'
}

const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    slug: 'super-admin',
    name: 'Super Admin',
    description: 'Sistem tam yetki. Permission listesi ve rol kendisi düzenlenemez.',
    isProtected: true,
    permissions: 'ALL',
  },
  {
    slug: 'admin',
    name: 'Admin',
    description: 'Genel sistem yönetimi (kullanıcı yönetimi hariç).',
    isProtected: false,
    permissions: [
      P.ADMIN_SYSTEM_MANAGE, P.ADMIN_AUDIT_VIEW,
      P.AKADEMI_VIEW, P.AKADEMI_REPORT_VIEW,
      P.ARSIV_VIEW, P.BGYS_DOCUMENT_VIEW,
      P.CALISAN_REHBERI_VIEW, P.HELPDESK_TICKET_VIEW,
      P.DUYURU_VIEW, P.DUYURU_CREATE, P.DUYURU_ADMIN,
    ],
  },
  {
    slug: 'bgys-sorumlusu',
    name: 'BGYS Sorumlusu',
    description: 'ISO 27001 BGYS dokümantasyon ve risk yönetimi.',
    isProtected: false,
    permissions: [
      P.BGYS_DOCUMENT_VIEW, P.BGYS_DOCUMENT_CREATE, P.BGYS_DOCUMENT_EDIT,
      P.BGYS_DOCUMENT_APPROVE, P.BGYS_RISK_MANAGE, P.BGYS_AUDIT_MANAGE,
      P.ADMIN_AUDIT_VIEW,
      P.AKADEMI_VIEW, P.AKADEMI_REPORT_VIEW,
      P.CALISAN_REHBERI_VIEW,
    ],
  },
  {
    slug: 'it-admin',
    name: 'IT Admin',
    description: 'IT altyapı, helpdesk ve sistem yönetimi.',
    isProtected: false,
    permissions: [
      P.HELPDESK_ADMIN, P.HELPDESK_TICKET_VIEW, P.HELPDESK_TICKET_ASSIGN,
      P.HELPDESK_TICKET_RESOLVE, P.HELPDESK_TICKET_CREATE,
      P.ADMIN_USERS_MANAGE, P.ADMIN_SYSTEM_MANAGE, P.ADMIN_BACKUP_MANAGE,
      P.ADMIN_AUDIT_VIEW,
      P.CALISAN_REHBERI_VIEW,
    ],
  },
  {
    slug: 'hr-yoneticisi',
    name: 'HR Yöneticisi',
    description: 'İK modülleri (personel, izin, eğitim raporları).',
    isProtected: false,
    permissions: [
      P.CALISAN_REHBERI_ADMIN, P.CALISAN_REHBERI_VIEW,
      P.IZIN_ADMIN, P.IZIN_APPROVE, P.IZIN_CREATE,
      P.AKADEMI_VIEW, P.AKADEMI_REPORT_VIEW,
      P.DUYURU_CREATE, P.DUYURU_VIEW,
    ],
  },
  {
    slug: 'kalite-yoneticisi',
    name: 'Kalite Yöneticisi',
    description: 'Kalibrasyon, yangın tüpü, kalite süreçleri.',
    isProtected: false,
    permissions: [
      P.KALIBRASYON_ADMIN, P.KALIBRASYON_VIEW,
      P.YANGIN_ADMIN, P.YANGIN_QR_SCAN, P.YANGIN_VIEW,
      P.BGYS_DOCUMENT_VIEW,
      P.CALISAN_REHBERI_VIEW,
    ],
  },
  {
    slug: 'kalibrasyon-operatoru',
    name: 'Kalibrasyon Operatörü',
    description: 'Kalibrasyon cihazlarını yöneten operatör. Sadece kalibrasyon modülüne erişim.',
    isProtected: false,
    permissions: [
      P.KALIBRASYON_ADMIN, P.KALIBRASYON_VIEW,
    ],
  },
  {
    slug: 'akademi-admin',
    name: 'Akademi Admin',
    description: 'Akademi modülü tam yönetim.',
    isProtected: false,
    permissions: [
      P.AKADEMI_ADMIN, P.AKADEMI_VIEW,
      P.AKADEMI_KURS_CREATE, P.AKADEMI_KURS_EDIT, P.AKADEMI_KURS_DELETE,
      P.AKADEMI_REPORT_VIEW, P.AKADEMI_CERT_MANAGE, P.AKADEMI_GRADE_MANUAL,
      P.CALISAN_REHBERI_VIEW,
    ],
  },
  {
    slug: 'departman-muduru',
    name: 'Departman Müdürü',
    description: 'Kendi departmanı için onay yetkileri (scope: own_department, Faz 2).',
    isProtected: false,
    permissions: [
      P.IZIN_APPROVE, P.IZIN_CREATE,
      P.HELPDESK_TICKET_VIEW, P.HELPDESK_TICKET_CREATE,
      P.AKADEMI_VIEW, P.AKADEMI_REPORT_VIEW,
      P.CALISAN_REHBERI_VIEW,
      P.DUYURU_VIEW,
      P.COSTANALYSIS_VIEW,
    ],
  },
  {
    slug: 'kullanici',
    name: 'Kullanıcı',
    description: 'Tüm çalışanlara verilen varsayılan rol.',
    isProtected: true,
    permissions: [
      P.AKADEMI_VIEW,
      P.ARSIV_VIEW,
      P.CALISAN_REHBERI_VIEW,
      P.IZIN_CREATE,
      P.YANGIN_QR_SCAN, P.YANGIN_VIEW,
      P.HELPDESK_TICKET_CREATE, P.HELPDESK_TICKET_VIEW,
      P.DUYURU_VIEW,
      P.KALIBRASYON_VIEW,
    ],
  },
]

async function main() {
  console.log('👥 Sistem rolleri seed başlıyor...')

  // Tüm permission'ları çek (key → id eşlemesi için)
  const allPerms = await prisma.permission.findMany()
  const permIdByKey = new Map(allPerms.map(p => [p.key, p.id]))
  const allPermIds = allPerms.map(p => p.id)

  if (allPerms.length === 0) {
    throw new Error('Permission tablosu boş. Önce seed-permissions çalıştır.')
  }

  for (const def of SYSTEM_ROLES) {
    // Rolü upsert et
    const role = await prisma.role.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        isSystem: true,
        isProtected: def.isProtected,
      },
      update: {
        name: def.name,
        description: def.description,
        isSystem: true,
        isProtected: def.isProtected,
      },
    })

    // Bu rolün sahip olması gereken permission ID listesi
    let targetPermIds: string[]
    if (def.permissions === 'ALL') {
      targetPermIds = allPermIds
    } else {
      targetPermIds = def.permissions
        .map(k => permIdByKey.get(k))
        .filter((v): v is string => Boolean(v))

      const missing = def.permissions.filter(k => !permIdByKey.has(k))
      if (missing.length > 0) {
        console.warn(`⚠️ ${def.slug}: bilinmeyen permission'lar atlandı:`, missing)
      }
    }

    // Mevcut role_permission kayıtları
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    })
    const existingIds = new Set(existing.map(r => r.permissionId))
    const targetSet = new Set(targetPermIds)

    // Eklenecekler
    const toAdd = targetPermIds.filter(id => !existingIds.has(id))
    // Silinecekler (artık rolde olmaması gerekenler)
    const toRemove = [...existingIds].filter(id => !targetSet.has(id))

    if (toAdd.length > 0) {
      await prisma.rolePermission.createMany({
        data: toAdd.map(permissionId => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      })
    }
    if (toRemove.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: toRemove } },
      })
    }

    console.log(`  ✓ ${def.name.padEnd(22)} → ${targetPermIds.length} yetki (+${toAdd.length} / -${toRemove.length})`)
  }

  console.log('✅ Sistem rolleri hazır.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
