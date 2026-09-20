import { describe, it, expect } from 'vitest'
import { hedefUyarisi, parcaKoduAnahtari, HEDEF_UYARI_ORAN, HEDEF_UYARI_MIN_GECMIS } from './overtime-performance'

// Hedef uyarısı (20.09.2026): yalnız ALT eşik (hedef < medyan/10), ≥2 geçmiş kayıt; engellemez.
describe('parcaKoduAnahtari', () => {
  it('sayısal kod (açıklamalı) → ilk token', () => {
    expect(parcaKoduAnahtari('8005 Delik Delme / Enjeksiyon')).toBe('8005')
    expect(parcaKoduAnahtari('8004-1')).toBe('8004-1')
  })
  it('serbest metin → null (uyarı yok)', () => {
    expect(parcaKoduAnahtari('AYAR')).toBeNull()
    expect(parcaKoduAnahtari('taşlama 2775-2776')).toBeNull()
  })
})
describe('hedefUyarisi', () => {
  const g = { parcaKodu: '8005', n: 8, min: 55, max: 2000, medyan: 1200 }
  it('hedef medyanın 1/10 altı → uyarı metni aralığı ve girileni gösterir', () => {
    expect(hedefUyarisi(g, 1)).toBe('Bu parça için geçmiş hedefler 55–2000 arasında (8 kayıt). Girdiğiniz: 1')
  })
  it('sınır: tam 1/10 → uyarı yok; üst sapma → uyarı yok (yalnız alt eşik)', () => {
    expect(hedefUyarisi(g, 1200 / HEDEF_UYARI_ORAN)).toBeNull()
    expect(hedefUyarisi(g, 20000)).toBeNull()
  })
  it('geçmiş yok / yetersiz → uyarı yok', () => {
    expect(hedefUyarisi(null, 1)).toBeNull()
    expect(hedefUyarisi({ ...g, n: HEDEF_UYARI_MIN_GECMIS - 1 }, 1)).toBeNull()
  })
})
