import { describe, expect, it } from 'vitest'
import { durakKodu } from './servis-durak-kodu'
import {
  ACIK_MADDELER,
  BELIRSIZ_DURAKLAR,
  DURAK_ESLEME,
  ESLEME_ACIK,
  GUZERGAHLAR,
  OLASI_YINELENEN_DURAKLAR,
  TOSB,
  TUM_GUZERGAHLAR,
} from './servis-tanim-verisi'

const TR: Record<string, string> = {
  ç: 'C', ğ: 'G', ş: 'S', ö: 'O', ü: 'U', ı: 'I', 'İ': 'I',
  'Ç': 'C', 'Ğ': 'G', 'Ş': 'S', 'Ö': 'O', 'Ü': 'U',
}
/** goc-siniflandirma.ts'teki normalizeTR ile aynı kural. */
const norm = (s: string) =>
  s.split('').map((c) => TR[c] ?? c).join('').toUpperCase().replace(/[^A-Z0-9]/g, '')

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

  // 106 yerleşmiş (dev DB) + 27 İdari İşler eşleme tablosundan.
  it('9 güzergâh, 133 durak', () => {
    expect(GUZERGAHLAR).toHaveLength(9)
    expect(GUZERGAHLAR.reduce((t, g) => t + g.duraklar.length, 0)).toBe(133)
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

describe('durak eşleme tablosu', () => {
  it('51 net satır, 14 açık satır, 65 toplam', () => {
    expect(DURAK_ESLEME).toHaveLength(51)
    expect(ESLEME_ACIK).toHaveLength(14)
    expect(DURAK_ESLEME.length + ESLEME_ACIK.length).toBe(65)
  })

  it('satır numaraları 1..65, çakışmasız', () => {
    const hepsi = [...DURAK_ESLEME.map((e) => e.satir), ...ESLEME_ACIK.map((e) => e.satir)]
    expect(hepsi.sort((a, b) => a - b)).toEqual(Array.from({ length: 65 }, (_, i) => i + 1))
  })

  it('kişi sayıları: net 75, açık 18', () => {
    expect(DURAK_ESLEME.reduce((t, e) => t + e.kisi, 0)).toBe(75)
    expect(ESLEME_ACIK.reduce((t, e) => t + e.kisi, 0)).toBe(18)
  })

  // 🔴 Asıl kural: her hedef, kendi güzergâhında TAM OLARAK BİR durağa
  // çözülmeli. Sıfır çözerse atama düşer, birden fazla çözerse hangisine
  // gideceği belirsiz kalır.
  it('her hedef kendi güzergâhında tam olarak bir durağa çözülüyor', () => {
    for (const e of DURAK_ESLEME) {
      const g = TUM_GUZERGAHLAR.find((x) => x.kod === e.guzergah)
      expect(g, `satır ${e.satir}: güzergâh ${e.guzergah}`).toBeDefined()
      const eslesen = g!.duraklar.filter((d) => norm(d.ad) === norm(e.hedef))
      expect(eslesen.length, `satır ${e.satir}: "${e.hedef}"`).toBe(1)
    }
  })

  // Ham metin eşleştirme anahtarı: aynı normalize metin iki farklı hedefe
  // gidemez, yoksa göç script'i hangisini seçeceğini bilemez.
  it('ham metin anahtarı belirsiz değil', () => {
    const anahtar = new Map<string, string>()
    for (const e of DURAK_ESLEME) {
      const k = norm(e.hamMetin)
      const onceki = anahtar.get(k)
      if (onceki !== undefined) {
        expect(onceki, `satır ${e.satir}: "${e.hamMetin}" iki hedefe gidiyor`).toBe(
          e.guzergah + '§' + norm(e.hedef),
        )
      }
      anahtar.set(k, e.guzergah + '§' + norm(e.hedef))
    }
  })

  it('açık satırların ham metni net tabloda geçmiyor', () => {
    const net = new Set(DURAK_ESLEME.map((e) => norm(e.hamMetin)))
    for (const e of ESLEME_ACIK) {
      expect(net.has(norm(e.hamMetin)), `satır ${e.satir}: "${e.hamMetin}"`).toBe(false)
    }
  })

  it('güzergâh kodları tanımlı güzergâhlara ait', () => {
    const kodlar = new Set(TUM_GUZERGAHLAR.map((g) => g.kod))
    for (const e of [...DURAK_ESLEME, ...ESLEME_ACIK]) {
      expect(kodlar.has(e.guzergah), `satır ${e.satir}`).toBe(true)
    }
  })

  // Bu liste karar bekliyor; kendiliğinden birleştirme YAPILMADI.
  it('olası yinelenen duraklar kayıtlı ve hepsi gerçekten veride var', () => {
    expect(OLASI_YINELENEN_DURAKLAR).toHaveLength(13)
    for (const y of OLASI_YINELENEN_DURAKLAR) {
      const g = TUM_GUZERGAHLAR.find((x) => x.kod === y.guzergah)!
      expect(g.duraklar.some((d) => norm(d.ad) === norm(y.yeniAd)), y.yeniAd).toBe(true)
      for (const b of y.benzerMevcut) {
        expect(g.duraklar.find((d) => d.sira === b.sira)?.ad, `${y.yeniAd} ~ ${b.ad}`).toBe(b.ad)
      }
    }
  })
})
