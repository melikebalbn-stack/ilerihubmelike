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
      P.FORMS_ADMIN, P.FORMS_APPROVE,
      P.RECRUITMENT_ADMIN, P.RECRUITMENT_CREATE, P.RECRUITMENT_CANDIDATE_VIEW,
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
      P.FORMS_ADMIN,
    ],
  },
  {
    slug: 'hr-yoneticisi',
    name: 'HR Yöneticisi',
    description: 'İK modülleri (personel, izin, eğitim raporları). Akademi admin (Y5-PREP, eski HR_MANAGER enum uyumu).',
    isProtected: false,
    permissions: [
      P.CALISAN_REHBERI_ADMIN, P.CALISAN_REHBERI_VIEW,
      P.IZIN_ADMIN, P.IZIN_APPROVE, P.IZIN_CREATE,
      // Y5-PREP: akademi.admin — eski HR_MANAGER enum'ında olan kullanıcılar
      // Y5a Akademi adopt'unda Akademi admin sayfalarına erişimini koruyabilsin
      P.AKADEMI_ADMIN, P.AKADEMI_VIEW, P.AKADEMI_REPORT_VIEW,
      P.DUYURU_CREATE, P.DUYURU_VIEW,
      P.FORMS_ADMIN,
      P.RECRUITMENT_ADMIN, P.RECRUITMENT_CREATE, P.RECRUITMENT_CANDIDATE_VIEW,
    ],
  },
  {
    // Rol PROD/DEV ortamlarında ELLE açılmıştı ve bu dosyada tanımlı DEĞİLDİ;
    // sıfırdan kurulan bir ortamda seed-servis-role-mapping.ts onu bulamayıp
    // exit(1) veriyordu. Tanım buraya alındı (Melih kararı, 2026-09-23).
    //
    // name/isProtected canlı kayıttan BİREBİR alındı (dev DB: name='İdari
    // İşler', is_system=t, is_protected=f) — mevcut satır varsa seed ona
    // DOKUNMAZ, bu değerler yalnız yeni ortamda oluşacak kayıt için geçerli.
    //
    // Yetki listesi TÜRETİLMİŞTİR, icat edilmemiştir: seed-servis-role-
    // mapping.ts'teki 6 servis anahtarı ile dev DB'deki fiilî 6 satır
    // BİREBİR aynı. Rolün başka hiçbir yetkisi yok — kendiliğinden yetki
    // EKLENMEDİ.
    //
    // 🔴 servis.sikayet.view / servis.sikayet.manage (MASTER madde 46) bu
    // role ait AMA dev/elif/servis-sikayet-permission dalında duruyor ve bu
    // daldan görünmüyor; o dal main'e girince buraya da eklenmeli.
    slug: 'idari-isler',
    name: 'İdari İşler',
    description: 'Servis yönetimi operasyonu (güzergâh/durak/araç tanımları, sorumlu atamaları, işlem geçmişi).',
    isProtected: false,
    permissions: [
      // 🔴 Bu 4 anahtarın PERMISSION_KEYS'te SABİTİ YOK — yalnız
      // seed-permissions.ts'teki SERVIS_PERMISSIONS haritasında tanımlılar,
      // bu yüzden P.* yerine düz metin yazmak ZORUNLU. Derleme zamanı koruma
      // olmadığı için yazımları seed-permissions.ts'e karşı karakter karakter
      // doğrulandı. Sabitler permissions.ts'e eklenirse burası P.*'a çevrilmeli.
      P.SERVIS_VIEW,
      'servis.create',
      'servis.edit',
      'servis.history',
      P.SERVIS_TANIM_MANAGE,
      'servis.sorumlu.manage',
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
      P.FORMS_ADMIN,
      P.FIF_MANAGE,
    ],
  },
  {
    slug: 'kalibrasyon-operatoru',
    name: 'Kalibrasyon Operatörü',
    description: 'Kalibrasyon cihazlarını yöneten operatör. Sadece kalibrasyon modülü + çalışan rehberi erişimi.',
    isProtected: false,
    permissions: [
      P.KALIBRASYON_ADMIN, P.KALIBRASYON_VIEW,
      P.CALISAN_REHBERI_VIEW, // Y7-PREP: telefon/departman bilgisi günlük iş için
    ],
  },
  {
    slug: 'maliyet-uzmani',
    name: 'Maliyet Uzmanı',
    description: 'Should-cost analizleri yöneten uzman. Tüm maliyet analizlerini görür, oluşturur, düzenler. Çalışan rehberi erişimi.',
    isProtected: false,
    permissions: [
      P.COSTANALYSIS_ADMIN, P.COSTANALYSIS_VIEW,
      P.COSTANALYSIS_CREATE, P.COSTANALYSIS_EDIT,
      P.CALISAN_REHBERI_VIEW, // departman/telefon bilgisi maliyet hesabı için işe yarar
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
      P.AKADEMI_IFS_EVALUATE,
      P.CALISAN_REHBERI_VIEW,
    ],
  },
  {
    slug: 'ifs-egitmeni',
    name: 'IFS Eğitmeni',
    description: 'IFS canlı değerlendirme: görev/ders değerlendirmesi (read raporu + değerlendirme).',
    isProtected: false,
    permissions: [
      P.AKADEMI_VIEW, P.AKADEMI_REPORT_VIEW, P.AKADEMI_IFS_EVALUATE,
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
      P.FORMS_ADMIN, P.FORMS_APPROVE,
      P.RECRUITMENT_VIEW, P.RECRUITMENT_CREATE,
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
  {
    slug: 'uretim-operator',
    name: 'Üretim Operatörü',
    description: 'Üretim istasyonu (terminal) hesabı.',
    isProtected: false,
    permissions: [
      P.URETIM_BILDIRIM,
    ],
  },
]

async function main() {
  console.log('👥 Sistem rolleri seed (bootstrap-only) başlıyor...')

  // PR-SEED-DRIFT: Bootstrap-only pattern
  // - Role kayıtları: yoksa create, varsa DOKUNMA (UI'dan değiştirilmiş
  //   name/description/isProtected korunur)
  // - RolePermission tablosu: BOŞSA initial seed, DOLU ise hiç dokunma
  //   (UI = tek doğruluk kaynağı, Y6c-PREP-NEW-ROLE drift bug'ı kapandı)

  const allPerms = await prisma.permission.findMany()
  const permIdByKey = new Map(allPerms.map(p => [p.key, p.id]))
  const allPermIds = allPerms.map(p => p.id)

  if (allPerms.length === 0) {
    throw new Error('Permission tablosu boş. Önce seed-permissions çalıştır.')
  }

  // Role kayıtlarını eksikse oluştur (mevcut kayda dokunma)
  let rolesCreated = 0
  let rolesSkipped = 0
  for (const def of SYSTEM_ROLES) {
    const existing = await prisma.role.findUnique({ where: { slug: def.slug } })
    if (existing) {
      rolesSkipped++
    } else {
      await prisma.role.create({
        data: {
          slug: def.slug,
          name: def.name,
          description: def.description,
          isSystem: true,
          isProtected: def.isProtected,
        },
      })
      rolesCreated++
      console.log(`  ✓ Role oluşturuldu: ${def.name} (${def.slug})`)
    }
  }
  console.log(
    `  Role özet: +${rolesCreated} oluşturuldu, ${rolesSkipped} mevcut korundu`
  )

  // RolePermission: tablo boşsa initial bootstrap, dolu ise dokunma
  const rolePermCount = await prisma.rolePermission.count()

  if (rolePermCount === 0) {
    console.log('📦 RolePermission tablosu BOŞ — initial bootstrap yapılıyor...')

    let totalCreated = 0
    for (const def of SYSTEM_ROLES) {
      const role = await prisma.role.findUnique({ where: { slug: def.slug } })
      if (!role) {
        console.warn(`  ⚠️ ${def.slug}: role bulunamadı, atlandı`)
        continue
      }

      let targetPermIds: string[]
      if (def.permissions === 'ALL') {
        targetPermIds = allPermIds
      } else {
        targetPermIds = def.permissions
          .map(k => permIdByKey.get(k))
          .filter((v): v is string => Boolean(v))

        const missing = def.permissions.filter(k => !permIdByKey.has(k))
        if (missing.length > 0) {
          console.warn(
            `  ⚠️ ${def.slug}: bilinmeyen permission'lar atlandı:`,
            missing
          )
        }
      }

      if (targetPermIds.length > 0) {
        const result = await prisma.rolePermission.createMany({
          data: targetPermIds.map(permissionId => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        })
        totalCreated += result.count
        console.log(`  ✓ ${def.name.padEnd(22)} → ${result.count} yetki bootstrap`)
      }
    }
    console.log(`✅ Initial RolePermission bootstrap tamam: ${totalCreated} kayıt`)
  } else {
    console.log(
      `ℹ️ RolePermission tablosu dolu (${rolePermCount} kayıt) — UI yönetiminde, seed dokunmadı.`
    )
    console.log(
      '   Yeni permission key veya rol değişiklikleri için /settings/permissions matris UI üzerinden yapın.'
    )
  }

  console.log('✅ Sistem rolleri seed (bootstrap-only) tamamlandı.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
