/**
 * oeePanoData — batched pano (entegrasyon, dev DB). Açık iş yoksa (dev'de 0) pano yine açılır:
 * tezgahlar dizisi dolu, her kartın canliOee null, durum boşta/fiziksel. statusCek poller'a
 * ulaşamazsa null → katman atlanır, çökmez. izleme-service'e DOKUNULMAZ (yalnız fiziksel-aktivite import).
 */
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { oeePanoData } from './oee-pano-service'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('oeePanoData', () => {
  it('açık iş yokken pano açılır — tezgahlar dolu, canliOee null, esik=50', async () => {
    const acikSayisi = await prisma.iproProductionLog.count({ where: { durum: 'ACIK' } })
    const pano = await oeePanoData()

    expect(Array.isArray(pano.tezgahlar)).toBe(true)
    expect(pano.tezgahlar.length).toBeGreaterThan(0) // dev'de aktif tezgahlar var
    expect(pano.esik).toBe(50)
    expect(pano.ozet.toplam).toBe(pano.tezgahlar.length)
    // özet sayaçları toplam = toplam tezgah
    expect(pano.ozet.calisiyor + pano.ozet.durusta + pano.ozet.bosta).toBe(pano.ozet.toplam)

    if (acikSayisi === 0) {
      // Açık iş yoksa hiçbir kartta canlı OEE olmamalı, calisan null
      expect(pano.tezgahlar.every((t) => t.canliOee === null)).toBe(true)
      expect(pano.tezgahlar.every((t) => t.calisan === null)).toBe(true)
      expect(pano.ozet.calisiyor).toBe(0)
    }
  })

  it('durum yalnız calisiyor|durusta|bosta; kod/ad dolu', async () => {
    const pano = await oeePanoData()
    for (const t of pano.tezgahlar) {
      expect(['calisiyor', 'durusta', 'bosta']).toContain(t.durum)
      expect(typeof t.kod).toBe('string')
      expect(t.kod.length).toBeGreaterThan(0)
    }
  })
})
