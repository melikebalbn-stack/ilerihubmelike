import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DAY = 24 * 60 * 60 * 1000

async function main() {
  const now = new Date()

  const DEVICES = [
    {
      deviceId: 'CAL001',
      name: 'Dijital Kumpas',
      type: 'Ölçüm Cihazı',
      calibrationType: 'Kalibrasyon',
      manufacturer: 'Mitutoyo',
      model: '500-196',
      serialNumber: 'SN-CAL001',
      location: 'ILERI-1',
      department: 'Kalite',
      productionSection: 'CMM',
      calibrationInterval: 365,
      lastCalibrationDate: new Date(now.getTime() - 30 * DAY),
      nextCalibrationDate: new Date(now.getTime() + 335 * DAY),
      status: 'VALID' as const,
    },
    {
      deviceId: 'CAL002',
      name: 'Hassas Terazi',
      type: 'Ölçüm Cihazı',
      calibrationType: 'Kalibrasyon',
      manufacturer: 'Sartorius',
      model: 'BP 210 S',
      serialNumber: 'SN-CAL002',
      location: 'ILERI-1',
      department: 'Üretim',
      productionSection: 'KAYNAKHANE',
      calibrationInterval: 180,
      lastCalibrationDate: new Date(now.getTime() - 170 * DAY),
      nextCalibrationDate: new Date(now.getTime() + 10 * DAY),
      status: 'EXPIRING' as const,
    },
    {
      deviceId: 'CAL003',
      name: 'Tork Anahtarı',
      type: 'Test Ekipmanı',
      calibrationType: 'Doğrulama',
      manufacturer: 'Norbar',
      model: 'TTi 200',
      serialNumber: 'SN-CAL003',
      location: 'ILERI-1',
      department: 'Mühendislik',
      productionSection: null,
      calibrationInterval: 365,
      lastCalibrationDate: new Date(now.getTime() - 400 * DAY),
      nextCalibrationDate: new Date(now.getTime() - 35 * DAY),
      status: 'EXPIRED' as const,
    },
    {
      deviceId: 'CAL004',
      name: 'pH Metre',
      type: 'Analiz Cihazı',
      calibrationType: 'Kal/Doğ',
      manufacturer: 'Hanna',
      model: 'HI-2211',
      serialNumber: 'SN-CAL004',
      location: 'ILERI-1',
      department: 'Kalite',
      productionSection: 'KALİTE LABORATUVAR',
      calibrationInterval: 365,
      lastCalibrationDate: new Date(now.getTime() - 60 * DAY),
      nextCalibrationDate: new Date(now.getTime() + 305 * DAY),
      status: 'VALID' as const,
    },
  ]

  console.log('Test cihazları ekleniyor...')
  for (const d of DEVICES) {
    const existing = await prisma.calibrationDevice.findUnique({ where: { deviceId: d.deviceId } })
    if (existing) {
      console.log(`  = Zaten var: ${d.deviceId} (${d.name})`)
      continue
    }
    await prisma.calibrationDevice.create({ data: d })
    console.log(`  + Eklendi: ${d.deviceId} - ${d.name} (${d.department}${d.productionSection ? ' / ' + d.productionSection : ''}) [${d.status}]`)
  }

  const total = await prisma.calibrationDevice.count()
  console.log(`\nToplam cihaz: ${total}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
