/**
 * seed-test-kiosk.ts — TEST kiosk cihazi olusturur (dev).
 *
 * GÜVENLİK:
 *   - VARSAYILAN DRY-RUN. Yazmak icin --commit.
 *   - dev-guard: DATABASE_URL 'ilerihub_dev' ICERMIYORSA → DUR (prod/staging asla).
 *
 * Calistirma:
 *   npx tsx --env-file=.env scripts/ipro/seed-test-kiosk.ts            (dry-run)
 *   npx tsx --env-file=.env scripts/ipro/seed-test-kiosk.ts --commit   (yazar)
 *
 * NE YAZAR (idempotent):
 *   User        kiosk-test@kiosk.ilerigroup.com, role KIOSK, employeeId NULL, isActive true
 *               (employeeId NULL → /api/bluecollar-users GET listesine DUSMEZ.
 *                duz cuid id → ldap-sync "guvenlik kemeri" bu satira dokunmaz.)
 *   IproKiosk   kod KIOSK-TEST, sifre 'kiosktest123' (bcrypt, pin-utils.hashPin).
 *               validatePinStrength UYGULANMAZ — kiosk sifresi PIN degil.
 *   IproKioskTezgah  ilk 3 IproTezgah'a baglanti (kompozit unique → idempotent).
 *
 * Tezgah UYDURMAZ: 3 tezgah yoksa DUR.
 */
import { createPrisma } from './_lib'
import { hashPin } from '../../src/lib/pin-utils'

const COMMIT = process.argv.includes('--commit')

const KIOSK_KOD = 'KIOSK-TEST'
const KIOSK_AD = 'Test Terminal'
const KIOSK_SIFRE = 'kiosktest123'
const USER_EMAIL = 'kiosk-test@kiosk.ilerigroup.com'

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  const masked = url.replace(/:[^:@]+@/, ':****@')
  console.log(`\nDB: ${masked}`)

  const { prisma, disconnect } = createPrisma()
  try {
    // ── Tezgahlar (dry-run'da da okunur) ──
    const tezgahlar = await prisma.iproTezgah.findMany({
      take: 3,
      orderBy: { id: 'asc' },
      select: { id: true, kod: true, ad: true },
    })
    if (tezgahlar.length < 3) {
      throw new Error(`DUR: IproTezgah 3'ten az (${tezgahlar.length}). Once tezgah import edilmeli — uydurma YOK.`)
    }

    const mevcutUser = await prisma.user.findUnique({ where: { email: USER_EMAIL }, select: { id: true } })
    const mevcutKiosk = await prisma.iproKiosk.findUnique({ where: { kod: KIOSK_KOD }, select: { id: true } })

    console.log('\nPLAN')
    console.log(`  User      ${USER_EMAIL}  → ${mevcutUser ? 'MEVCUT (korunur)' : 'OLUSTURULACAK'}`)
    console.log(`  IproKiosk ${KIOSK_KOD}                     → ${mevcutKiosk ? 'MEVCUT (sifre KORUNUR)' : 'OLUSTURULACAK'}`)
    console.log(`  Tezgah baglantisi (3):`)
    for (const t of tezgahlar) console.log(`    - ${t.kod}  ${t.ad}`)

    if (!COMMIT) {
      console.log('\n--- DRY-RUN: yazma YOK. Yazmak icin --commit. ---\n')
      return
    }

    // dev-guard: prod/staging'e ASLA yazma
    if (!url.includes('ilerihub_dev')) {
      throw new Error(`GUVENLIK DURDU: DATABASE_URL dev degil → ${masked}`)
    }

    // ── User (idempotent; sentetik email, employeeId YOK) ──
    const user = await prisma.user.upsert({
      where: { email: USER_EMAIL },
      update: { role: 'KIOSK', isActive: true },
      create: {
        email: USER_EMAIL,
        name: KIOSK_AD,
        role: 'KIOSK',
        isActive: true,
        // employeeId bilincli olarak VERILMEZ (null) → IK listesine dusmez.
      },
      select: { id: true, email: true, role: true, employeeId: true, isActive: true },
    })

    // ── IproKiosk (idempotent; sifreHash YALNIZ create'te — her kosuda hash cirpilmasin) ──
    const kiosk = await prisma.iproKiosk.upsert({
      where: { kod: KIOSK_KOD },
      update: { ad: KIOSK_AD, aktif: true, userId: user.id },
      create: {
        kod: KIOSK_KOD,
        ad: KIOSK_AD,
        sifreHash: await hashPin(KIOSK_SIFRE),
        userId: user.id,
        aktif: true,
      },
      select: { id: true, kod: true, ad: true, aktif: true },
    })

    // ── Tezgah baglantilari (kompozit unique → skipDuplicates idempotent) ──
    const res = await prisma.iproKioskTezgah.createMany({
      data: tezgahlar.map((t) => ({ kioskId: kiosk.id, tezgahId: t.id })),
      skipDuplicates: true,
    })

    const bagli = await prisma.iproKioskTezgah.findMany({
      where: { kioskId: kiosk.id },
      select: { tezgah: { select: { kod: true, ad: true } } },
    })

    console.log('\nOZET')
    console.log(`  Kiosk kod     : ${kiosk.kod}  (aktif=${kiosk.aktif})`)
    console.log(`  Kiosk sifre   : ${KIOSK_SIFRE}  (bcrypt hash'li saklandi)`)
    console.log(`  User id       : ${user.id}`)
    console.log(`  User email    : ${user.email}`)
    console.log(`  User role     : ${user.role}   employeeId=${user.employeeId ?? 'NULL (IK listesine dusmez)'}`)
    console.log(`  Yeni baglanti : ${res.count}  (toplam bagli: ${bagli.length})`)
    console.log(`  Bagli tezgahlar:`)
    for (const b of bagli) console.log(`    - ${b.tezgah.kod}  ${b.tezgah.ad}`)
    console.log()
  } finally {
    await disconnect()
  }
}

main().catch((e) => {
  console.error('\n⛔ DUR:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
