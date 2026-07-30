/**
 * IPRO takvim servis testi (integration — gerçek dev DB). Kendi kayıtlarını temizler.
 */
import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listVardiyalar, createVardiya, updateVardiya, listTatiller, createTatil, deleteTatil } from './takvim'

const KOD1 = 'TEST-VDY-1'
const YIL = 2099 // test yılı — gerçek veriyle çakışmaz

async function temizle() {
  await prisma.iproVardiya.deleteMany({ where: { kod: { startsWith: 'TEST-VDY' } } })
  await prisma.iproTatil.deleteMany({ where: { yil: YIL } })
}
beforeEach(temizle)
afterAll(async () => { await temizle(); await prisma.$disconnect() })

describe('vardiya CRUD', () => {
  it('ekle → liste → düzenle (ertesiGuneTasar dahil)', async () => {
    const v = await createVardiya({ kod: KOD1, ad: 'Test V', baslangicSaat: '21:00', bitisSaat: '07:00', ertesiGuneTasar: true, sira: 5, aktif: true })
    expect(v.kod).toBe(KOD1)
    const liste = await listVardiyalar()
    const bulunan = liste.find((x) => x.kod === KOD1)
    expect(bulunan?.ertesiGuneTasar).toBe(true)
    await updateVardiya(v.id, { ad: 'Güncel', aktif: false })
    const g = await prisma.iproVardiya.findUnique({ where: { id: v.id } })
    expect(g).toMatchObject({ ad: 'Güncel', aktif: false, ertesiGuneTasar: true })
  })
  it('aynı kod ikinci kez → unique ihlali', async () => {
    await createVardiya({ kod: KOD1, ad: 'A', baslangicSaat: '07:00', bitisSaat: '17:00', ertesiGuneTasar: false, sira: 1, aktif: true })
    await expect(createVardiya({ kod: KOD1, ad: 'B', baslangicSaat: '08:00', bitisSaat: '18:00', ertesiGuneTasar: false, sira: 2, aktif: true }))
      .rejects.toThrow()
  })
})

describe('tatil (çalışma takvimi) CRUD', () => {
  const gun = new Date(`${YIL}-08-30T00:00:00.000Z`)
  it('ekle → yıla göre listele → yil türetildi', async () => {
    const t = await createTatil({ tarih: gun, tip: 'TATIL', aciklama: 'Zafer Bayramı' })
    expect(t.tip).toBe('TATIL')
    const liste = await listTatiller(YIL)
    expect(liste.map((x) => x.aciklama)).toContain('Zafer Bayramı')
    expect(liste[0].yil).toBe(YIL) // tarih'ten türetildi
  })
  it('aynı güne çift kayıt → unique ihlali (gün bazlı tek kayıt)', async () => {
    await createTatil({ tarih: gun, tip: 'TATIL', aciklama: 'ilk' })
    await expect(createTatil({ tarih: gun, tip: 'YARIM', aciklama: 'ikinci' })).rejects.toThrow()
  })
  it('sil → listeden kalkar', async () => {
    const t = await createTatil({ tarih: gun, tip: 'MESAI', aciklama: 'çalışılan cumartesi' })
    await deleteTatil(t.id)
    expect((await listTatiller(YIL)).length).toBe(0)
  })
})
