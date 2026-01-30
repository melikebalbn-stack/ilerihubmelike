/**
 * Kullanıcı unvanlarını LDAP'tan senkronize et
 * Çalıştır: npx tsx scripts/sync-user-titles.ts
 */

// Load environment variables FIRST before any other imports
import { config } from 'dotenv'
config()

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { Client } from 'ldapts'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// LDAP Konfigürasyonu
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://192.168.2.20:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=ilerigroup,DC=com',
  usersDN: process.env.LDAP_USERS_DN || 'OU=ilerigroup,DC=ilerigroup,DC=com',
  bindDN: process.env.LDAP_BIND_DN || 'svc_ilerihub@ilerigroup.com',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
}

// LDAP Filter escape
function escapeLDAPFilter(str: string): string {
  return str
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\x00/g, '\\00')
    .replace(/\//g, '\\2f')
}

// String değer al
function getStringValue(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.toString() || null
  if (Buffer.isBuffer(value)) return value.toString()
  return String(value)
}

interface LDAPUser {
  mail: string | null
  title: string | null
  displayName: string | null
}

async function searchUserByEmail(client: Client, email: string): Promise<LDAPUser | null> {
  try {
    const safeEmail = escapeLDAPFilter(email)
    const { searchEntries } = await client.search(LDAP_CONFIG.usersDN, {
      scope: 'sub',
      filter: `(&(objectClass=user)(objectCategory=person)(mail=${safeEmail}))`,
      attributes: ['mail', 'title', 'displayName', 'cn'],
    })

    if (searchEntries.length === 0) {
      return null
    }

    const entry = searchEntries[0]
    return {
      mail: getStringValue(entry.mail),
      title: getStringValue(entry.title),
      displayName: getStringValue(entry.displayName) || getStringValue(entry.cn)
    }
  } catch (err) {
    console.error(`LDAP arama hatası: ${email}`, (err as Error).message)
    return null
  }
}

async function main() {
  console.log('LDAP bağlantısı kuruluyor...')
  console.log(`URL: ${LDAP_CONFIG.url}`)
  console.log(`Users DN: ${LDAP_CONFIG.usersDN}`)

  const ldapClient = new Client({
    url: LDAP_CONFIG.url,
    timeout: 10000,
    connectTimeout: 10000,
  })

  try {
    await ldapClient.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword)
    console.log('LDAP bağlantısı başarılı\n')
  } catch (err) {
    console.error('LDAP bağlantı hatası:', (err as Error).message)
    process.exit(1)
  }

  // Unvanı olmayan kullanıcıları al
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { jobTitle: null },
        { jobTitle: '' }
      ]
    },
    select: {
      id: true,
      email: true,
      name: true,
      jobTitle: true
    }
  })

  console.log(`${users.length} kullanıcının unvanı güncellenecek\n`)

  let updated = 0
  let notFound = 0
  let errors = 0

  for (const user of users) {
    try {
      const ldapUser = await searchUserByEmail(ldapClient, user.email)

      if (ldapUser?.title) {
        await prisma.user.update({
          where: { id: user.id },
          data: { jobTitle: ldapUser.title }
        })
        console.log(`✓ ${user.name}: ${ldapUser.title}`)
        updated++
      } else {
        console.log(`- ${user.name} (${user.email}): LDAP'ta unvan bulunamadı`)
        notFound++
      }
    } catch (err) {
      console.error(`✗ ${user.name}: Hata - ${(err as Error).message}`)
      errors++
    }
  }

  await ldapClient.unbind()
  await prisma.$disconnect()

  console.log('\n--- Özet ---')
  console.log(`Güncellenen: ${updated}`)
  console.log(`Unvan bulunamayan: ${notFound}`)
  console.log(`Hata: ${errors}`)
}

main().catch(err => {
  console.error('Script hatası:', err)
  process.exit(1)
})
