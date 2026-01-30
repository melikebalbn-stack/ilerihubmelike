/**
 * Kullanıcı unvanlarını LDAP'tan senkronize et
 * Çalıştır: node scripts/sync-user-titles.mjs
 */

import { PrismaClient } from '../src/generated/prisma/index.js'
import ldap from 'ldapjs'

const prisma = new PrismaClient()

const LDAP_URL = process.env.LDAP_URL || 'ldap://172.16.16.1'
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || 'DC=ilerigroup,DC=com'
const LDAP_BIND_DN = process.env.LDAP_BIND_DN || 'CN=ldap_query,OU=Service Accounts,OU=ilerigroup,DC=ilerigroup,DC=com'
const LDAP_BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD || ''

function searchLdap(client, email) {
  return new Promise((resolve, reject) => {
    const opts = {
      filter: `(mail=${email})`,
      scope: 'sub',
      attributes: ['mail', 'title', 'displayName']
    }

    client.search(LDAP_BASE_DN, opts, (err, res) => {
      if (err) {
        reject(err)
        return
      }

      let user = null

      res.on('searchEntry', (entry) => {
        const obj = entry.pojo
        user = {
          mail: obj.attributes.find(a => a.type === 'mail')?.values?.[0],
          title: obj.attributes.find(a => a.type === 'title')?.values?.[0],
          displayName: obj.attributes.find(a => a.type === 'displayName')?.values?.[0]
        }
      })

      res.on('error', (err) => {
        reject(err)
      })

      res.on('end', () => {
        resolve(user)
      })
    })
  })
}

async function main() {
  console.log('LDAP bağlantısı kuruluyor...')

  const client = ldap.createClient({
    url: LDAP_URL,
    reconnect: true
  })

  // Bind to LDAP
  await new Promise((resolve, reject) => {
    client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })

  console.log('LDAP bağlantısı başarılı')

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

  console.log(`${users.length} kullanıcının unvanı güncellenecek`)

  let updated = 0
  let notFound = 0
  let errors = 0

  for (const user of users) {
    try {
      const ldapUser = await searchLdap(client, user.email)

      if (ldapUser?.title) {
        await prisma.user.update({
          where: { id: user.id },
          data: { jobTitle: ldapUser.title }
        })
        console.log(`✓ ${user.name}: ${ldapUser.title}`)
        updated++
      } else {
        console.log(`- ${user.name}: LDAP'ta unvan bulunamadı`)
        notFound++
      }
    } catch (err) {
      console.error(`✗ ${user.name}: Hata - ${err}`)
      errors++
    }
  }

  client.unbind()
  await prisma.$disconnect()

  console.log('\n--- Özet ---')
  console.log(`Güncellenen: ${updated}`)
  console.log(`Unvan bulunamayan: ${notFound}`)
  console.log(`Hata: ${errors}`)
}

main().catch(console.error)
