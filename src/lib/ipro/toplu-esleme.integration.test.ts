/**
 * topluOperatorEsleme — bulk upsert (entegrasyon, dev DB, MM63). personnelId FK'sız çıplak string
 * (IPRO bloğu deseni) → sahte pid'ler kullanılır. Yeni ekle / pasifi reaktive / zaten aktifi atla.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { topluOperatorEsleme } from './yonetim-service'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'
const PID_YENI = 'test-toplu-yeni'
const PID_PASIF = 'test-toplu-pasif'
const PID_AKTIF = 'test-toplu-aktif'
const HEPSI = [PID_YENI, PID_PASIF, PID_AKTIF]

async function temizle() {
  await prisma.iproOperatorTezgah.deleteMany({ where: { tezgahId: MM63_ID, personnelId: { in: HEPSI } } })
}

beforeEach(async () => {
  await temizle()
  await prisma.iproOperatorTezgah.create({ data: { tezgahId: MM63_ID, personnelId: PID_PASIF, aktif: false, kaynak: 'MANUEL' } })
  await prisma.iproOperatorTezgah.create({ data: { tezgahId: MM63_ID, personnelId: PID_AKTIF, aktif: true, kaynak: 'MANUEL' } })
})

afterAll(async () => {
  await temizle()
  await prisma.$disconnect()
})

describe('topluOperatorEsleme', () => {
  it('yeni ekler / pasifi reaktive eder / zaten aktifi atlar', async () => {
    const s = await topluOperatorEsleme(MM63_ID, HEPSI)
    expect(s.eklenen).toBe(1) // PID_YENI
    expect(s.reaktiveEdilen).toBe(1) // PID_PASIF
    expect(s.zatenAktif).toBe(1) // PID_AKTIF
    expect(s.toplam).toBe(3)

    const rows = await prisma.iproOperatorTezgah.findMany({
      where: { tezgahId: MM63_ID, personnelId: { in: HEPSI } },
      select: { personnelId: true, aktif: true, kaynak: true },
    })
    const byId = new Map(rows.map((r) => [r.personnelId, r]))
    expect(byId.get(PID_YENI)).toMatchObject({ aktif: true, kaynak: 'TOPLU' }) // yeni satır TOPLU kaynaklı
    expect(byId.get(PID_PASIF)?.aktif).toBe(true) // reaktive
    expect(byId.get(PID_AKTIF)?.aktif).toBe(true) // korunur
    expect(rows).toHaveLength(3) // pasif reaktive edildi, YENİ satır AÇILMADI
  })

  it('çift kayıt AÇMAZ — reaktive tek satırda kalır (@@unique)', async () => {
    await topluOperatorEsleme(MM63_ID, [PID_PASIF])
    const say = await prisma.iproOperatorTezgah.count({ where: { tezgahId: MM63_ID, personnelId: PID_PASIF } })
    expect(say).toBe(1)
  })

  it('boş liste → hepsi 0 (no-op)', async () => {
    const s = await topluOperatorEsleme(MM63_ID, [])
    expect(s).toEqual({ eklenen: 0, reaktiveEdilen: 0, zatenAktif: 0, toplam: 0 })
  })

  it('tekrarlı id (dup girdi) tekilleştirilir', async () => {
    const s = await topluOperatorEsleme(MM63_ID, [PID_YENI, PID_YENI, PID_YENI])
    expect(s.eklenen).toBe(1)
    expect(s.toplam).toBe(1)
  })
})
