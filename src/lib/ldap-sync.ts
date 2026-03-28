/**
 * LDAP → DB Senkronizasyon Modülü
 *
 * Active Directory tek kaynak (Single Source of Truth).
 * Bu modül LDAP'daki tüm aktif kullanıcıları DB'ye senkronize eder.
 *
 * Tetikleyiciler:
 * 1. Login Sync (mevcut - auth.ts'deki upsert)
 * 2. Periyodik Sync (cron - 6 saatte bir)
 * 3. Manuel Sync (admin butonu)
 */

import { getAllLDAPUsers, determineUserRole, getEmailFromDN, type LDAPUser } from './ldap'
import { prisma } from './prisma'
import { Role } from '@/generated/prisma'
import { logger } from './logger'

// SUPER_ADMIN listesi (auth.ts ile senkron)
const SUPER_ADMIN_EMAILS = [
  'halit.ileri@ilerigroup.com',
  'gurhan.horbay@ilerigroup.com',
  'hilmi.ileri@ilerigroup.com',
  'eren.ileri@ilerigroup.com',
  'koray.ileri@ilerigroup.com',
  'melike.balaban@ilerigroup.com',
]

// Ortak/sistem hesapları (senkronizasyondan hariç)
const SYSTEM_ACCOUNTS = [
  '1.toplantiodasi@ilerigroup.com',
  '2.kattoplantiodasi@ilerigroup.com',
  '2.toplantiodasi@ilerigroup.com',
  'bakimhane@ilerigroup.com',
  'depomail@ilerigroup.com',
  'kaliphane@ilerigroup.com',
  'final.kalite@ilerigroup.com',
  'final.kalite2@ilerigroup.com',
  'giris.kalite@ilerigroup.com',
  'giris.kalite2@ilerigroup.com',
  'kalite.proses@ilerigroup.com',
  'kalite.proses2@ilerigroup.com',
  'koordinat@ilerigroup.com',
  'preshane.barkod@ilerigroup.com',
  'yemekhane@ilerigroup.com',
]

// Son sync durumu (in-memory)
let lastSyncStatus: SyncStatus = {
  lastSyncAt: null,
  status: 'idle',
  created: 0,
  updated: 0,
  deactivated: 0,
  errors: 0,
  totalLdap: 0,
  totalDb: 0,
  errorDetails: [],
}

export interface SyncStatus {
  lastSyncAt: string | null
  status: 'idle' | 'running' | 'completed' | 'failed'
  created: number
  updated: number
  deactivated: number
  errors: number
  totalLdap: number
  totalDb: number
  errorDetails: string[]
  duration?: number
}

/** LDAP rolünü Prisma Role enum'una dönüştür */
function mapLdapRoleToPrismaRole(ldapRole: string, email?: string): Role {
  if (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return Role.SUPER_ADMIN
  }

  const roleMap: Record<string, Role> = {
    'SUPER_ADMIN': Role.SUPER_ADMIN,
    'ADMIN': Role.ADMIN,
    'HR_MANAGER': Role.HR_MANAGER,
    'QUALITY_MANAGER': Role.QUALITY_MANAGER,
    'IT_MANAGER': Role.IT_MANAGER,
    'DEPT_HEAD': Role.DEPT_HEAD,
    'SUPERVISOR': Role.SUPERVISOR,
    'EMPLOYEE': Role.EMPLOYEE,
    'USER': Role.EMPLOYEE,
  }
  return roleMap[ldapRole] || Role.EMPLOYEE
}

/** Bir kullanıcının sistem/ortak hesap olup olmadığını kontrol et */
function isSystemAccount(email: string): boolean {
  return SYSTEM_ACCOUNTS.includes(email.toLowerCase())
}

/**
 * Ana senkronizasyon fonksiyonu
 * Tüm LDAP kullanıcılarını DB'ye upsert eder.
 */
export async function syncLDAPUsersToDb(): Promise<SyncStatus> {
  if (lastSyncStatus.status === 'running') {
    return lastSyncStatus
  }

  const startTime = Date.now()

  lastSyncStatus = {
    lastSyncAt: new Date().toISOString(),
    status: 'running',
    created: 0,
    updated: 0,
    deactivated: 0,
    errors: 0,
    totalLdap: 0,
    totalDb: 0,
    errorDetails: [],
  }

  try {
    logger.info('LDAP-SYNC', 'Senkronizasyon başlatılıyor...')

    // 1. LDAP'dan tüm aktif kullanıcıları çek
    const ldapUsers = await getAllLDAPUsers()
    lastSyncStatus.totalLdap = ldapUsers.length

    // Email'i olan ve sistem hesabı olmayan kullanıcıları filtrele
    const validUsers = ldapUsers.filter(user => {
      if (!user.email || typeof user.email !== 'string' || user.email.trim().length === 0) return false
      if (isSystemAccount(user.email)) return false
      return true
    })

    logger.info('LDAP-SYNC', `LDAP: ${ldapUsers.length} toplam, ${validUsers.length} geçerli kullanıcı`)

    // 2. DB'deki mevcut kullanıcıları çek (karşılaştırma için)
    const dbUsers = await prisma.user.findMany({
      select: { id: true, email: true, isActive: true },
    })
    lastSyncStatus.totalDb = dbUsers.length

    const dbEmailSet = new Set(dbUsers.map(u => u.email.toLowerCase()))
    const dbIdSet = new Set(dbUsers.map(u => u.id))
    const ldapEmailSet = new Set(validUsers.map(u => u.email!.toLowerCase()))

    // 3. Manager DN -> email çözümleme (batch)
    const managerDNs = new Set(validUsers.map(u => u.managerDN).filter(Boolean) as string[])
    const managerEmailMap = new Map<string, string>()

    // Manager email'lerini LDAP kullanıcılarından çöz (LDAP sorgusu yapmadan)
    for (const user of ldapUsers) {
      if (user.distinguishedName && user.email) {
        managerEmailMap.set(user.distinguishedName.toLowerCase(), user.email.toLowerCase())
      }
    }

    // 4. Kullanıcıları upsert et (batch - 10'luk gruplar)
    const batchSize = 10
    for (let i = 0; i < validUsers.length; i += batchSize) {
      const batch = validUsers.slice(i, i + batchSize)

      await Promise.all(batch.map(async (ldapUser) => {
        try {
          await upsertUser(ldapUser, managerEmailMap)

          if (dbEmailSet.has(ldapUser.email!.toLowerCase()) || dbIdSet.has(`ad_${ldapUser.username}`)) {
            lastSyncStatus.updated++
          } else {
            lastSyncStatus.created++
          }
        } catch (error) {
          lastSyncStatus.errors++
          const errMsg = `${ldapUser.email}: ${error instanceof Error ? error.message : String(error)}`
          if (lastSyncStatus.errorDetails.length < 20) {
            lastSyncStatus.errorDetails.push(errMsg)
          }
          logger.error('LDAP-SYNC', 'Kullanıcı upsert hatası', { email: ldapUser.email, error: errMsg })
        }
      }))
    }

    // 5. LDAP'da olmayan DB kullanıcılarını devre dışı bırak
    // (Sadece ad_ prefix'li kullanıcılar - LDAP'dan gelenler. Bluecollar ve manuel eklenenler hariç)
    for (const dbUser of dbUsers) {
      if (
        dbUser.isActive &&
        dbUser.id.startsWith('ad_') &&
        !ldapEmailSet.has(dbUser.email.toLowerCase()) &&
        !isSystemAccount(dbUser.email)
      ) {
        try {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { isActive: false },
          })
          lastSyncStatus.deactivated++
          logger.info('LDAP-SYNC', 'Kullanıcı devre dışı bırakıldı', { email: dbUser.email })
        } catch (error) {
          lastSyncStatus.errors++
        }
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000)
    lastSyncStatus.status = 'completed'
    lastSyncStatus.duration = duration

    logger.info('LDAP-SYNC', 'Senkronizasyon tamamlandı', {
      created: lastSyncStatus.created,
      updated: lastSyncStatus.updated,
      deactivated: lastSyncStatus.deactivated,
      errors: lastSyncStatus.errors,
      duration: `${duration}s`,
    })

    return lastSyncStatus
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000)
    lastSyncStatus.status = 'failed'
    lastSyncStatus.duration = duration
    lastSyncStatus.errorDetails.push(
      `Genel hata: ${error instanceof Error ? error.message : String(error)}`
    )

    logger.error('LDAP-SYNC', 'Senkronizasyon başarısız', {
      error: error instanceof Error ? error.message : String(error),
    })

    return lastSyncStatus
  }
}

/** Tek bir LDAP kullanıcısını DB'ye upsert et */
async function upsertUser(
  ldapUser: LDAPUser,
  managerEmailMap: Map<string, string>
): Promise<void> {
  const email = ldapUser.email!.trim()
  const emailLower = email.toLowerCase()
  const ldapRole = determineUserRole(ldapUser)
  const prismaRole = mapLdapRoleToPrismaRole(ldapRole, emailLower)
  const userId = `ad_${ldapUser.username}`

  // Manager email'ini çöz
  let managerEmail: string | null = null
  if (ldapUser.managerDN) {
    managerEmail = managerEmailMap.get(ldapUser.managerDN.toLowerCase()) || null
  }

  // AD'den gelen alanlar (her sync'te güncellenir)
  const adFields = {
    name: ldapUser.displayName,
    department: ldapUser.department,
    jobTitle: ldapUser.title,
    officeLocation: ldapUser.ou,
    ...(ldapUser.ipPhone ? { extension3cx: ldapUser.ipPhone } : {}),
    role: prismaRole,
    isActive: true,
  }

  const managerData = managerEmail ? { managerId: await getManagerId(managerEmail) } : {}

  // Önce id ile bul (login olmuş kullanıcılar ad_username formatında)
  const existingById = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })

  if (existingById) {
    // Kullanıcı var - güncelle (id ile)
    await prisma.user.update({
      where: { id: userId },
      data: { ...adFields, ...managerData },
    })
    return
  }

  // id ile bulunamadı - email ile ara (case-insensitive)
  const existingByEmail = await prisma.user.findFirst({
    where: { email: { equals: emailLower, mode: 'insensitive' } },
    select: { id: true, email: true },
  })

  if (existingByEmail) {
    // Email eşleşti - güncelle
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: { ...adFields, ...managerData },
    })
    return
  }

  // Kullanıcı hiç yok - oluştur
  await prisma.user.create({
    data: {
      id: userId,
      email,
      ...adFields,
      ...managerData,
    },
  })
}

/** Manager email'inden DB user ID'sini getir */
async function getManagerId(managerEmail: string): Promise<string | undefined> {
  try {
    const manager = await prisma.user.findUnique({
      where: { email: managerEmail.toLowerCase() },
      select: { id: true },
    })
    return manager?.id || undefined
  } catch {
    return undefined
  }
}

/** Son sync durumunu döndür */
export function getLastSyncStatus(): SyncStatus {
  return { ...lastSyncStatus }
}
