import { describe, it, expect } from 'vitest'
import { isAyarlarBolumu, canAccessAyarlar, ayarlarBolumMetniMi } from './ayarlar-erisim'

describe('ayarlarBolumMetniMi', () => {
  it('İnsan Varlıkları yazımlarını yakalar', () => {
    for (const s of [
      'İnsan Varlıkları Müdürlüğü',
      'Insan Varliklari Departmanı',
      'INSAN VARLIKLARI',
      'insan varlıkları',
    ]) {
      expect(ayarlarBolumMetniMi(s)).toBe(true)
    }
  })

  it('İdari İşler yazımlarını yakalar — Türkçe İ dahil', () => {
    for (const s of ['İdari İşler', 'IDARI ISLER', 'İDARİ İŞLER', 'idari isler']) {
      expect(ayarlarBolumMetniMi(s)).toBe(true)
    }
  })

  it('başka bölümleri yakalamaz', () => {
    for (const s of ['Kalite Müdürlüğü', 'Kaynakhane', 'Satınalma Müdürlüğü', '', null, undefined]) {
      expect(ayarlarBolumMetniMi(s)).toBe(false)
    }
  })
})

describe('isAyarlarBolumu', () => {
  it('department ya da ou alanlarından biri yeterli', () => {
    expect(isAyarlarBolumu('İdari İşler', null)).toBe(true)
    expect(isAyarlarBolumu(null, 'Insan Varliklari')).toBe(true)
    expect(isAyarlarBolumu('Kaynakhane', 'Kaynakhane')).toBe(false)
  })
})

describe('canAccessAyarlar', () => {
  it('mevcut Kalite kuralını bozmaz', () => {
    expect(canAccessAyarlar('SUPER_ADMIN', 'Kaynakhane', null)).toBe(true)
    expect(canAccessAyarlar('QUALITY_MANAGER', 'Kaynakhane', null)).toBe(true)
    expect(canAccessAyarlar('EMPLOYEE', 'KALİTE MÜDÜRLÜĞÜ', null)).toBe(true)
  })

  it('İV ve İdari İşler artık girebilir', () => {
    expect(canAccessAyarlar('EMPLOYEE', 'İdari İşler', null)).toBe(true)
    expect(canAccessAyarlar('EMPLOYEE', 'İnsan Varlıkları Müdürlüğü', null)).toBe(true)
  })

  it('kapsam dışı kullanıcı hâlâ giremez', () => {
    expect(canAccessAyarlar('EMPLOYEE', 'Kaynakhane', 'Kaynakhane')).toBe(false)
    expect(canAccessAyarlar('DEPT_HEAD', 'Satınalma Müdürlüğü', null)).toBe(false)
  })
})

describe('FK öncelikli bölüm (personelBolum)', () => {
  it('User.department boş olsa da FK bölümü karar verir', () => {
    // 01.10.2026 ölçümü: ILR-01118 (İdari İşler Sorumlusu) User.department BOŞ,
    // Personnel FK'sı "İdari İşler". Metin yolu yetmiyor, FK yolu yetiyor.
    expect(isAyarlarBolumu('', null)).toBe(false)
    expect(isAyarlarBolumu('', null, 'İdari İşler')).toBe(true)
    expect(canAccessAyarlar('EMPLOYEE', '', null, 'İdari İşler')).toBe(true)
  })

  it('FK doluysa AD metni DİKKATE ALINMAZ — eski metin yetkiyi geri getiremez', () => {
    expect(isAyarlarBolumu('İdari İşler', null, 'Kaynakhane')).toBe(false)
  })

  it('FK yoksa eski metin yoluna düşer', () => {
    expect(isAyarlarBolumu('İDARİ İŞLER', null, null)).toBe(true)
    expect(isAyarlarBolumu('Kaynakhane', null, undefined)).toBe(false)
  })
})
