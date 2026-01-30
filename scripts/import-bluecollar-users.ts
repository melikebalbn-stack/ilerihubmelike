/**
 * Mavi Yaka Kullanıcı Toplu Yükleme Scripti
 *
 * Kullanım:
 *   npx tsx scripts/import-bluecollar-users.ts data/mavi-yaka-import.csv
 *
 * CSV Formatı (virgül ile ayrılmış):
 *   sicil_no,tc_son_4,ad_soyad,email,departman,telefon
 *   00207,4772,ABDULLAH MAKSUTOĞLU,,MEKANİK MONTAJ,+905467331295
 *
 * Notlar:
 *   - İlk satır başlık satırı olmalı
 *   - Email opsiyoneldir, girilmezse sicil_no@bluecollar.ilerigroup.com olarak oluşturulur
 *   - Departman opsiyoneldir
 *   - Telefon opsiyoneldir (+90 formatında)
 */

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface BlueCollarUser {
  employeeId: string
  tcLastFour: string
  name: string
  email?: string
  department?: string
  mobilePhone?: string
}

function parseCSV(content: string): BlueCollarUser[] {
  const lines = content.trim().split('\n')
  const users: BlueCollarUser[] = []

  // İlk satır başlık
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',').map(p => p.trim())

    if (parts.length < 3) {
      console.warn(`Satır ${i + 1}: Yetersiz alan sayısı, atlanıyor`)
      continue
    }

    const [sicilNo, tcSon4, adSoyad, email, departman, telefon] = parts

    // TC son 4 hane doğrulama
    if (!/^\d{4}$/.test(tcSon4)) {
      console.warn(`Satır ${i + 1}: TC son 4 hane geçersiz (${tcSon4}), atlanıyor`)
      continue
    }

    users.push({
      employeeId: sicilNo,
      tcLastFour: tcSon4,
      name: adSoyad,
      email: email || undefined,
      department: departman || undefined,
      mobilePhone: telefon || undefined,
    })
  }

  return users
}

async function importUsers(users: BlueCollarUser[]) {
  let created = 0
  let updated = 0
  let errors = 0

  for (const user of users) {
    try {
      // Email yoksa oluştur
      const email = user.email || `${user.employeeId}@bluecollar.ilerigroup.com`

      // Önce employeeId ile kontrol et
      const existingByEmployeeId = await prisma.user.findUnique({
        where: { employeeId: user.employeeId }
      })

      if (existingByEmployeeId) {
        // Güncelle
        await prisma.user.update({
          where: { employeeId: user.employeeId },
          data: {
            tcLastFour: user.tcLastFour,
            name: user.name,
            department: user.department,
            mobilePhone: user.mobilePhone,
            isActive: true,
          }
        })
        console.log(`✓ Güncellendi: ${user.employeeId} - ${user.name}`)
        updated++
        continue
      }

      // Email ile kontrol et
      const existingByEmail = await prisma.user.findUnique({
        where: { email }
      })

      if (existingByEmail) {
        // employeeId ve tcLastFour ekle
        await prisma.user.update({
          where: { email },
          data: {
            employeeId: user.employeeId,
            tcLastFour: user.tcLastFour,
            name: user.name || existingByEmail.name,
            department: user.department || existingByEmail.department,
            mobilePhone: user.mobilePhone || existingByEmail.mobilePhone,
            isActive: true,
          }
        })
        console.log(`✓ Güncellendi (email ile): ${user.employeeId} - ${user.name}`)
        updated++
        continue
      }

      // Yeni kullanıcı oluştur
      await prisma.user.create({
        data: {
          email,
          employeeId: user.employeeId,
          tcLastFour: user.tcLastFour,
          name: user.name,
          department: user.department,
          mobilePhone: user.mobilePhone,
          role: 'EMPLOYEE',
          isActive: true,
        }
      })
      console.log(`✓ Oluşturuldu: ${user.employeeId} - ${user.name}`)
      created++

    } catch (error) {
      console.error(`✗ Hata (${user.employeeId}):`, error instanceof Error ? error.message : error)
      errors++
    }
  }

  return { created, updated, errors }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
Mavi Yaka Kullanıcı Toplu Yükleme Scripti

Kullanım:
  npx tsx scripts/import-bluecollar-users.ts <csv_dosyası>

CSV Formatı:
  sicil_no,tc_son_4,ad_soyad,email,departman,telefon
  00207,4772,ABDULLAH MAKSUTOĞLU,,MEKANİK MONTAJ,+905467331295

Notlar:
  - İlk satır başlık satırı olmalı
  - Email opsiyoneldir (otomatik oluşturulur)
  - Departman opsiyoneldir
  - Telefon opsiyoneldir (+90 formatında)
`)
    process.exit(1)
  }

  const csvPath = path.resolve(args[0])

  if (!fs.existsSync(csvPath)) {
    console.error(`Dosya bulunamadı: ${csvPath}`)
    process.exit(1)
  }

  console.log(`\nDosya okunuyor: ${csvPath}\n`)

  const content = fs.readFileSync(csvPath, 'utf-8')
  const users = parseCSV(content)

  console.log(`Toplam ${users.length} kullanıcı bulundu.\n`)

  if (users.length === 0) {
    console.log('İçe aktarılacak kullanıcı yok.')
    process.exit(0)
  }

  const { created, updated, errors } = await importUsers(users)

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
İçe Aktarma Tamamlandı
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Oluşturulan: ${created}
  Güncellenen: ${updated}
  Hata:        ${errors}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
