import { describe, expect, it } from 'vitest'
import { durakKodu } from './servis-durak-kodu'
import {
  ACIK_MADDELER,
  BELIRSIZ_DURAKLAR,
  GUZERGAHLAR,
  TOSB,
  TUM_GUZERGAHLAR,
} from './servis-tanim-verisi'

describe('servis tanım verisi', () => {
  it('güzergâh kodları benzersiz', () => {
    const kodlar = TUM_GUZERGAHLAR.map((g) => g.kod)
    expect(new Set(kodlar).size).toBe(kodlar.length)
  })

  it('her güzergâhın durak sırası 1..n, boşluksuz ve tekrarsız', () => {
    for (const g of TUM_GUZERGAHLAR) {
      const siralar = g.duraklar.map((d) => d.sira)
      expect(siralar, g.kod).toEqual(Array.from({ length: siralar.length }, (_, i) => i + 1))
    }
  })

  // Tekrar eden ad, metin eşleştirmesini belirsiz yapar. Bilinen iki çift
  // BELIRSIZ_DURAKLAR'da kayıtlı ve Elif'in kararını bekliyor; test YENİ
  // bir tekrarın sessizce eklenmesini engelliyor.
  it('durak adı tekrarları yalnız bilinen belirsiz çiftler', () => {
    const bulunan: string[] = []
    for (const g of TUM_GUZERGAHLAR) {
      const sayac = new Map<string, number>()
      for (const d of g.duraklar) sayac.set(d.ad, (sayac.get(d.ad) ?? 0) + 1)
      for (const [ad, n] of sayac) if (n > 1) bulunan.push(`${g.kod}/${ad}`)
    }
    expect(bulunan.sort()).toEqual(BELIRSIZ_DURAKLAR.map((b) => `${b.guzergah}/${b.ad}`).sort())
  })

  it('belirsiz çiftlerin kayıtlı sıraları veriyle uyuşuyor', () => {
    for (const b of BELIRSIZ_DURAKLAR) {
      const g = TUM_GUZERGAHLAR.find((x) => x.kod === b.guzergah)
      expect(g, b.guzergah).toBeDefined()
      const siralar = g!.duraklar.filter((d) => d.ad === b.ad).map((d) => d.sira)
      expect(siralar, `${b.guzergah}/${b.ad}`).toEqual([...b.siralar])
    }
  })

  it('durak adları boş veya kırpılmamış değil', () => {
    for (const g of TUM_GUZERGAHLAR) {
      for (const d of g.duraklar) {
        expect(d.ad, `${g.kod}/${d.sira}`).toBe(d.ad.trim())
        expect(d.ad.length, `${g.kod}/${d.sira}`).toBeGreaterThan(0)
      }
    }
  })

  // Göç script'i durağı KOD ile arar; kod çakışırsa yanlış durağa atama yapar.
  it('üretilen durak kodları veri genelinde benzersiz', () => {
    const kodlar = TUM_GUZERGAHLAR.flatMap((g) => g.duraklar.map((d) => durakKodu(g.kod, d.sira)))
    expect(new Set(kodlar).size).toBe(kodlar.length)
  })

  it('yerleşmiş veri: 9 güzergâh, 106 durak', () => {
    expect(GUZERGAHLAR).toHaveLength(9)
    expect(GUZERGAHLAR.reduce((t, g) => t + g.duraklar.length, 0)).toBe(106)
  })

  // TOSB güzergâhı tanımlı ama durakları İdari İşler'den gelmedi.
  // Bu test boş kalmasını SABİTLEMİYOR; dolduğunda düşmesi ve
  // "106 durak" sayısının da güncellenmesi için burada.
  it('TOSB tanımlı, durakları henüz gelmedi', () => {
    expect(TUM_GUZERGAHLAR).toContain(TOSB)
    expect(TOSB.duraklar).toHaveLength(0)
  })

  it('açık maddeler İdari İşler cevabı bekliyor — 6 madde', () => {
    expect(ACIK_MADDELER).toHaveLength(6)
    expect(new Set(ACIK_MADDELER.map((m) => m.no)).size).toBe(6)
    for (const m of ACIK_MADDELER) {
      expect(TUM_GUZERGAHLAR.map((g) => g.kod), `madde ${m.no}`).toContain(m.guzergah)
    }
  })
})
