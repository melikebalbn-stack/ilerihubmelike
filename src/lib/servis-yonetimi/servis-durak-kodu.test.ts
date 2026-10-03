import { describe, expect, it } from 'vitest'
import { durakKodu } from './servis-durak-kodu'

// A2 ÖLÇÜMÜ: durakKodu(güzergâh, sıra) bir ÜRETİM fonksiyonu (seed / göç). Kod
// SIRAYA bağlı üretilir, ama kod KİMLİKTİR (ServisDurak.kod @unique): sıra
// değişince ya da araya durak eklenince mevcut durakların kodu DEĞİŞMEZ
// (service.ts: yalnız ServisGuzergahDurak.sira güncellenir).
//
// Sonuç: araya ekleme sonrası durakKodu(güzergâh, <yeni durağın sirası>), o
// sirayı artık işgal etmeyen ama KODU hâlâ o sıraya ait olan mevcut bir durakla
// ÇAKIŞIR. Bu yüzden ekrandan eklenen durağın kodu durakKodu() ile ÜRETİLMEZ —
// elle girilir ve ServisDurak.kod @unique ile doğrulanır.
describe('durakKodu — sıraya bağlı üretim', () => {
  it('<GÜZERGÂH>-<sıra 2 hane>', () => {
    expect(durakKodu('DARICA', 4)).toBe('DARICA-04')
    expect(durakKodu('DARICA', 12)).toBe('DARICA-12')
    expect(durakKodu('DARICA', 104)).toBe('DARICA-104')
  })

  it('🔴 araya ekleme sonrası çakışma (ölçüm): yeni 4. sıradaki durak için üretilen kod, 5. sıraya kaymış eski durağın KORUNAN koduyla aynı', () => {
    // Başlangıç: DARICA-01..05 kodlu 5 durak, sıraları 1..5.
    const oncekiKodlar = [1, 2, 3, 4, 5].map((s) => durakKodu('DARICA', s))
    // 4. konuma durak eklenir: eski 4. ve 5. duraklar 5. ve 6. sıraya kayar, KODLARI SABİT.
    const yeniSiradakiUretilenKod = durakKodu('DARICA', 4)
    expect(oncekiKodlar).toContain(yeniSiradakiUretilenKod) // → ServisDurak.kod @unique ihlali olurdu
  })

  it('kod sıradan türetilmez: kayan durağın kodu sıra numarasına eşit değildir (kodun sıraya eşit olduğu varsayılamaz)', () => {
    const kayanDurakKodu = durakKodu('DARICA', 4) // araya ekleme öncesi 4. sıradaydı
    const kayanDurakYeniSira = 5
    expect(kayanDurakKodu).not.toBe(durakKodu('DARICA', kayanDurakYeniSira))
  })
})
