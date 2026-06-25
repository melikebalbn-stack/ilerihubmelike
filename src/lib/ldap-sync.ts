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
import { UserRoleEnum as Role } from '@/generated/prisma'
import { logger } from './logger'

// Email-bazlı rol override'ları (auth.ts ile senkron — tek source of truth
// gelecekte ortak modüle çıkarılabilir).
const ROLE_OVERRIDES: Record<string, Role> = {
  // SUPER_ADMIN — üst yönetim + sistem sahibi
  'halit.ileri@ilerigroup.com': Role.SUPER_ADMIN,
  'gurhan.horbay@ilerigroup.com': Role.SUPER_ADMIN,
  'koray.ileri@ilerigroup.com': Role.SUPER_ADMIN,
  'melike.balaban@ilerigroup.com': Role.SUPER_ADMIN,
  'melih.dilben@ilerigroup.com': Role.SUPER_ADMIN,
  // ADMIN — operasyonel yönetim
  'hilmi.ileri@ilerigroup.com': Role.ADMIN,
  'eren.ileri@ilerigroup.com': Role.ADMIN,
  'kadir.kocakoglu@ilerigroup.com': Role.ADMIN,
  // QUALITY_MANAGER
  'sami.tekoglu@ilerigroup.com': Role.QUALITY_MANAGER,
}

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

/**
 * PR-Y4-PRE: memberOf DN string'ini CN'e indir.
 *   "CN=BGYS-Yoneticileri,OU=Groups,DC=ilerigroup,DC=com" → "BGYS-Yoneticileri"
 * Eşleşme yoksa null döner (sentinel/sistem grupları için).
 */
export function parseGroupCN(memberOfDN: string): string | null {
  const match = memberOfDN.match(/^CN=([^,]+),/i)
  return match ? match[1] : null
}

/** PR-Y4-PRE: LDAPUser.memberOf → CN array (null'lar elenir) */
export function extractGroupCNs(memberOf: string[] | undefined | null): string[] {
  return (memberOf ?? [])
    .map(parseGroupCN)
    .filter((cn): cn is string => cn !== null)
}

/** LDAP rolünü Prisma Role enum'una dönüştür */
function mapLdapRoleToPrismaRole(ldapRole: string, email?: string): Role {
  // Email-bazlı override (SUPER_ADMIN/ADMIN/QUALITY_MANAGER vs.)
  if (email && ROLE_OVERRIDES[email.toLowerCase()]) {
    return ROLE_OVERRIDES[email.toLowerCase()]
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

/**
 * jobTitle bazlı role inference. LDAP'tan açık rol gelmediğinde
 * (default: EMPLOYEE) unvana göre Müdür/Yardımcı user'ları yükseltir.
 *
 * Sadece EMPLOYEE rolünü ezer — manuel atanmış SUPER_ADMIN/ADMIN/
 * *_MANAGER/DEPT_HEAD/SUPERVISOR rollerine dokunmaz.
 *
 *   "...Müdürü" / "...Mudur" / "...Muduru"  → DEPT_HEAD
 *   "...Müdür Yardımcısı" / "...Mudur Yardimcisi" / "...Asistan" → SUPERVISOR
 */
export function inferRoleFromJobTitle(
  jobTitle: string | null | undefined,
  currentRole: Role
): Role {
  if (currentRole !== Role.EMPLOYEE) return currentRole
  if (!jobTitle) return currentRole

  const title = jobTitle.toLowerCase()
  const hasMudur = /m[üu]d[üu]r/i.test(title)
  if (!hasMudur) return currentRole

  const isAssistant = /(yard[ıi]mc|asistan|vekil)/i.test(title)
  return isAssistant ? Role.SUPERVISOR : Role.DEPT_HEAD
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

    // PR-Y4a: Aktif LdapGroupRoleMap'leri tek seferde cache'le
    // Her user için ayrı query yapmak yerine memory'de filtre.
    const activeMappings = await prisma.ldapGroupRoleMap.findMany({
      where: { isActive: true },
      select: { groupCN: true, roleId: true },
    })
    const mappingByGroupCN = new Map<string, string>(
      activeMappings.map((m) => [m.groupCN, m.roleId])
    )
    logger.info('LDAP-SYNC', `Aktif mapping: ${activeMappings.length} grup → role eşleşmesi`)

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
          await upsertUser(ldapUser, managerEmailMap, mappingByGroupCN)

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

    // 5. PR-A: "AD sonuç listesinde YOK" (missing) ARTIK pasifleştirmez.
    // Pasifleştirme yalnızca upsert'teki isActive: !ldapUser.disabled (AD-disabled,
    // userAccountControl & 2) üzerinden gerçekleşir. Eskiden ldapEmailSet'te email'i
    // bulunmayan ad_ kullanıcıları isActive:false yapılıyordu; bu, partial LDAP
    // response'ta (26 May 2026'daki gibi tüm SUPER_ADMIN dahil 68 user) toplu
    // yanlış-pasifleşmeye yol açıyordu. Artık yalnızca BİLGİ amaçlı loglanır.
    for (const dbUser of dbUsers) {
      if (
        dbUser.isActive &&
        dbUser.id.startsWith('ad_') &&
        !ldapEmailSet.has(dbUser.email.toLowerCase()) &&
        !isSystemAccount(dbUser.email)
      ) {
        console.warn(
          `[LDAP-SYNC] AD sonuç listesinde görünmüyor (pasifleştirilmedi): ${dbUser.email}`,
        )
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
  managerEmailMap: Map<string, string>,
  mappingByGroupCN: Map<string, string>
): Promise<void> {
  const email = ldapUser.email!.trim()
  const emailLower = email.toLowerCase()
  const ldapRole = determineUserRole(ldapUser)
  const baseRole = mapLdapRoleToPrismaRole(ldapRole, emailLower)
  const prismaRole = inferRoleFromJobTitle(ldapUser.title, baseRole)
  const userId = `ad_${ldapUser.username}`

  // Güvenlik kemeri: sync YALNIZCA ad_ kaynaklı (LDAP) kullanıcıları işler.
  // Mavi yaka id'leri cuid'dir (ad_ değil) ve LDAP'ta yoktur → bu fonksiyona hiç gelmez.
  if (!ldapUser.username || !userId.startsWith('ad_')) {
    console.warn(`[LDAP-SYNC] Geçersiz/eksik sAMAccountName, kayıt atlandı: ${ldapUser.email}`)
    return
  }

  // Manager email'ini çöz
  let managerEmail: string | null = null
  if (ldapUser.managerDN) {
    managerEmail = managerEmailMap.get(ldapUser.managerDN.toLowerCase()) || null
  }

  // PR-Y4-PRE: memberOf DN'leri CN array'e indirgenir
  const groups = extractGroupCNs(ldapUser.memberOf)

  // AD'den gelen alanlar (her sync'te güncellenir)
  const adFields = {
    name: ldapUser.displayName,
    department: ldapUser.department,
    jobTitle: ldapUser.title,
    officeLocation: ldapUser.ou,
    ...(ldapUser.ipPhone ? { extension3cx: ldapUser.ipPhone } : {}),
    role: prismaRole,
    // PR-A: pasiflik AD-disabled (userAccountControl & 2) sinyaline bağlı.
    isActive: !ldapUser.disabled,
    groups, // PR-Y4-PRE
  }

  const managerData = managerEmail ? { managerId: await getManagerId(managerEmail) } : {}

  // Önce id ile bul (login olmuş kullanıcılar ad_username formatında)
  const existingById = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })

  let resolvedUserId: string

  if (existingById) {
    await prisma.user.update({
      where: { id: userId },
      data: { ...adFields, ...managerData },
    })
    resolvedUserId = userId
  } else {
    // id ile bulunamadı - email ile ara (case-insensitive)
    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: emailLower, mode: 'insensitive' } },
      select: { id: true, email: true },
    })

    if (existingByEmail) {
      // GÜVENLİK KEMERİ: email eşleşmesi ad_ OLMAYAN bir kayda (mavi yaka cuid id)
      // denk gelirse DOKUNMA — sync yalnız LDAP-kaynaklı (ad_) kullanıcıları yazar.
      // Mavi yaka isActive'i SADECE bluecollar route'undan değişmeli.
      if (!existingByEmail.id.startsWith('ad_')) {
        console.warn(
          `[LDAP-SYNC] ad_ olmayan kayda update atlandı (mavi yaka korundu): ${existingByEmail.email} (id=${existingByEmail.id})`,
        )
        return
      }
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { ...adFields, ...managerData },
      })
      resolvedUserId = existingByEmail.id
    } else {
      // Kullanıcı hiç yok - oluştur
      const created = await prisma.user.create({
        data: {
          id: userId,
          // PR-EMAIL-NORMALIZE: DB lowercase invariant — yazımları toLowerCase ile garantile
          email: email.toLowerCase(),
          ...adFields,
          ...managerData,
        },
        select: { id: true },
      })
      resolvedUserId = created.id
    }
  }

  // PR-Y4a: AD grupları → user_role tablosu (source='azure_ad') diff
  await syncUserAzureRoles(resolvedUserId, groups, mappingByGroupCN)
}

/**
 * PR-Y4a: Bir kullanıcının AD grup üyeliklerine göre user_role tablosunu
 * source='azure_ad' kayıtlar için diff'ler.
 *
 * KRİTİK KORUMA:
 *  - Manuel kayıtlar (source='manual') HİÇ DOKUNULMAZ.
 *  - Composite PK (userId, roleId) nedeniyle aynı user+role için tek kayıt
 *    olabilir; eğer mevcut kayıt 'manual' ise INSERT yapılmaz, manuel
 *    kayıt korunur (efektif olarak rol zaten atanmış sayılır).
 *  - Mapping inactive olduysa veya user gruptan çıktıysa, sadece
 *    source='azure_ad' kayıtları silinir.
 */
async function syncUserAzureRoles(
  userId: string,
  groups: string[],
  mappingByGroupCN: Map<string, string>
): Promise<void> {
  // 1. Hedef role ID'leri (AD'den match olanlar)
  const targetRoleIds = new Set<string>()
  for (const cn of groups) {
    const roleId = mappingByGroupCN.get(cn)
    if (roleId) targetRoleIds.add(roleId)
  }

  // 2. Bu user'ın mevcut KAYIT durumu (her source için)
  const existing = await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: true, source: true },
  })
  const existingByRoleId = new Map(existing.map((r) => [r.roleId, r.source]))

  // 3. Diff hesapla
  const toCreate: string[] = [] // sadece kayıt yoksa azure_ad ekle
  const toRemove: string[] = [] // azure_ad kayıt var ama AD'de yok → sil

  for (const targetRoleId of targetRoleIds) {
    const existingSource = existingByRoleId.get(targetRoleId)
    if (existingSource === undefined) {
      toCreate.push(targetRoleId) // hiç kayıt yok
    }
    // existingSource='manual' → DOKUNMA (manuel korunur)
    // existingSource='azure_ad' → ZATEN SENK (no-op)
  }

  for (const [existingRoleId, existingSource] of existingByRoleId) {
    if (existingSource === 'azure_ad' && !targetRoleIds.has(existingRoleId)) {
      toRemove.push(existingRoleId)
    }
  }

  if (toCreate.length === 0 && toRemove.length === 0) return

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.userRole.deleteMany({
        where: {
          userId,
          roleId: { in: toRemove },
          source: 'azure_ad', // KRİTİK: sadece azure_ad sil, manuel'e dokunma
        },
      })
    }
    if (toCreate.length > 0) {
      await tx.userRole.createMany({
        data: toCreate.map((roleId) => ({
          userId,
          roleId,
          source: 'azure_ad',
        })),
        skipDuplicates: true, // race condition koruması
      })
    }
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
