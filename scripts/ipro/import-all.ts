/**
 * (g) Orchestrator — tüm IPRO import'larını DOĞRU SIRAYLA tek Prisma bağlantısıyla çalıştırır.
 *
 * Sıra (FK bağımlılıkları): plc → tezgah → plc-pin(tezgah bağlama) → durus → hurda → operator
 *
 *   npx tsx --env-file=.env scripts/ipro/import-all.ts           # YAZMA
 *   npx tsx --env-file=.env scripts/ipro/import-all.ts --dry-run # önizleme
 *
 * Herhangi bir adım DUR ederse (hata fırlatırsa) zincir durur, hangi adımda durduğu
 * raporlanır, exit code 1. AYAR DURUŞU listesi import EDİLMEZ (ölü liste).
 */
import { createPrisma, parseDryRun, type Prisma } from './_lib'
import { importPlc } from './import-plc'
import { importTezgah } from './import-tezgah'
import { importPlcPin } from './import-plc-pin'
import { importDurus } from './import-durus'
import { importHurda } from './import-hurda'
import { importOperatorTezgah } from './import-operator-tezgah'

const STEPS: Array<[string, (p: Prisma, d: boolean) => Promise<any>]> = [
  ['import-plc', importPlc],
  ['import-tezgah', importTezgah],
  ['import-plc-pin', importPlcPin],
  ['import-durus', importDurus],
  ['import-hurda', importHurda],
  ['import-operator-tezgah', importOperatorTezgah],
]

async function main() {
  const dryRun = parseDryRun()
  const { prisma, disconnect } = createPrisma()
  console.log(`\n████ IPRO IMPORT-ALL ████  mod=${dryRun ? 'DRY-RUN' : 'YAZMA'}`)
  const results: Record<string, any> = {}
  try {
    for (const [name, fn] of STEPS) {
      try {
        results[name] = await fn(prisma, dryRun)
      } catch (e) {
        console.error(`\n⛔ DUR — "${name}" adımında hata: ${e instanceof Error ? e.message : e}`)
        console.error('   Zincir durduruldu; sonraki adımlar çalıştırılmadı.')
        process.exitCode = 1
        return
      }
    }
    console.log('\n████ TÜM ADIMLAR TAMAM ████')
    console.log(JSON.stringify(results, null, 2))
  } finally {
    await disconnect()
  }
}

main()
