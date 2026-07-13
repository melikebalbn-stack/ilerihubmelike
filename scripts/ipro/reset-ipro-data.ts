/**
 * reset-ipro-data.ts — SADECE ipro_* tablolarını boşaltır. Başka tabloya DOKUNMAZ.
 *
 * GÜVENLİK:
 *   - DATABASE_URL 'ilerihub_dev' İÇERMİYORSA → DUR, hiçbir şey silme (prod/staging asla).
 *   - --confirm bayrağı yoksa → DUR (kazara tetiklenmeyi önler).
 *
 * Çalıştırma:
 *   npx tsx --env-file=.env scripts/ipro/reset-ipro-data.ts --confirm
 *
 * FK-güvenli silme sırası (çocuklar → ebeveynler):
 *   durusTezgah, hurdaTezgah, operatorTezgah, machineDowntime, productionLog, operatorSession
 *   → durusSebebi, hurdaSebebi, durusTipi
 *   → plcPin, tezgah, plc
 * (plcPin, tezgah'tan ÖNCE tam silinir; ayrıca tezgahId'yi null'lamaya gerek kalmaz.)
 */
import { createPrisma } from './_lib'

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  const masked = url.replace(/:[^:@]+@/, ':****@')

  if (!url.includes('ilerihub_dev')) {
    throw new Error(`GÜVENLİK DURDU: DATABASE_URL 'ilerihub_dev' içermiyor → ${masked}. Reset yalnız dev'de çalışır.`)
  }
  if (!process.argv.includes('--confirm')) {
    throw new Error("--confirm bayrağı gerekli (kazara tetiklenmeyi önler):\n     npx tsx --env-file=.env scripts/ipro/reset-ipro-data.ts --confirm")
  }

  const { prisma, disconnect } = createPrisma()
  console.log(`\n████ IPRO RESET ████  DB=${masked}`)
  try {
    const steps: [string, () => Promise<{ count: number }>][] = [
      ['ipro_durus_tezgah', () => prisma.iproDurusTezgah.deleteMany()],
      ['ipro_hurda_tezgah', () => prisma.iproHurdaTezgah.deleteMany()],
      ['ipro_operator_tezgah', () => prisma.iproOperatorTezgah.deleteMany()],
      ['ipro_machine_downtime', () => prisma.iproMachineDowntime.deleteMany()],
      ['ipro_production_log', () => prisma.iproProductionLog.deleteMany()],
      ['ipro_operator_session', () => prisma.iproOperatorSession.deleteMany()],
      ['ipro_durus_sebebi', () => prisma.iproDurusSebebi.deleteMany()],
      ['ipro_hurda_sebebi', () => prisma.iproHurdaSebebi.deleteMany()],
      ['ipro_durus_tipi', () => prisma.iproDurusTipi.deleteMany()],
      ['ipro_plc_pin', () => prisma.iproPlcPin.deleteMany()],
      ['ipro_tezgah', () => prisma.iproTezgah.deleteMany()],
      ['ipro_plc', () => prisma.iproPlc.deleteMany()],
    ]
    for (const [name, fn] of steps) {
      const res = await fn()
      console.log(`  ✓ ${name.padEnd(24)} silinen: ${res.count}`)
    }
    console.log('\n████ RESET TAMAM — ipro_* boşaltıldı ████\n')
  } finally {
    await disconnect()
  }
}

main().catch((e) => {
  console.error('\n⛔ DUR:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
