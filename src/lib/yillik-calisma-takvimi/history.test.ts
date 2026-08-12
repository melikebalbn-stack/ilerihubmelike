import { describe, expect, it } from 'vitest'
import { ACTION_LABELS, formatHistoryEntry } from './history'
const base = { alan: 'x', eskiDeger: 'secret@example.com', createdAt: new Date('2026-08-09T10:00:00Z'), yapan: { name: 'Güvenli Ad' } }
describe('audit history formatter', () => {
  it('bilinen aksiyonları Türkçe etiketler', () => { for (const [action, label] of Object.entries(ACTION_LABELS)) expect(formatHistoryEntry({ ...base, islemTuru: action, yeniDeger: null }).label).toBe(label) })
  it('bilinmeyen aksiyonu metadata göstermeden güvenli fallback yapar', () => { const result = formatHistoryEntry({ ...base, islemTuru: 'ESKI_AKSIYON', yeniDeger: JSON.stringify({ email: 'x@y.com', saklamaYolu: '/secret' }) }); expect(result).toMatchObject({ action: 'DIGER', label: 'Diğer işlem', details: [] }); expect(JSON.stringify(result)).not.toContain('x@y.com') })
  it('yalnız whitelist alan adlarını gösterir', () => { const result = formatHistoryEntry({ ...base, islemTuru: 'GUNCELLE', yeniDeger: JSON.stringify({ degisenAlanlar: ['aciklama', 'password', 'email'] }) }); expect(result.details).toEqual(['Değişen alanlar: Açıklama']) })
  it('ek metadata içinden ID, dosya adı ve storage yolunu sızdırmaz', () => { const result = formatHistoryEntry({ ...base, islemTuru: 'EK_YUKLE', yeniDeger: JSON.stringify({ ekId: 'internal', dosyaAdi: 'kimlik.pdf', saklamaYolu: '/private/x', dosyaTuru: 'application/pdf', boyut: 2048 }) }); const text = JSON.stringify(result); expect(text).toContain('application/pdf'); expect(text).not.toMatch(/internal|kimlik|private/) })
  it('sonraki dönem bağlantısını ID sızdırmadan açıklar', () => { const result = formatHistoryEntry({ ...base, islemTuru: 'SONRAKI_DONEM_OLUSTURULDU', yeniDeger: JSON.stringify({ yeniKayitId: 'internal-id', kopyalananAlanlar: ['anaKonu', 'katilimcilar', 'password'] }) }); expect(result).toMatchObject({ label: 'Sonraki dönem oluşturuldu', details: ['Yeni dönem kaydı oluşturuldu', 'Kopyalanan bilgiler: Ana konu, Katılımcılar'] }); expect(JSON.stringify(result)).not.toContain('internal-id') })
  it.each([
    ['ONAY_GERI_ALINDI', 'Onay kararı geri alındı', { tur: 2, sira: 1, eskiKarar: 'REVIZYON_ISTENDI', gerekce: 'Bilgi düzeltilecek', oncekiDurum: 'REVIZYON_ISTENDI', yeniDurum: 'TAMAMLANDI_ONAY_BEKLIYOR' }, ['Onay turu: 2', 'Kademe: 1', 'Eski karar: Revizyon İstendi', 'Gerekçe: Bilgi düzeltilecek', 'Önceki durum: Revizyon İstendi', 'Yeni durum: Tamamlandı Onay Bekliyor']],
    ['BILDIRIM_KURALI_EKLE', 'Bildirim kuralı eklendi', { tetik: 'SON_TARIH_YAKLASIYOR' }, ['Tetikleyici: Son Tarih Yaklaşıyor']],
    ['BILDIRIM_KURALI_GUNCELLE', 'Bildirim kuralı güncellendi', { kuralId: 'internal-id' }, []],
    ['BILDIRIM_KURALI_SIL', 'Bildirim kuralı silindi', { tetik: 'GECIKTI' }, ['Tetikleyici: Gecikti']],
    ['DIS_KAYNAK_OLUSTUR', 'Dış kaynaktan kayıt oluşturuldu', { kaynakModul: 'HUKUK', degisenAlanlar: ['anaKonu', 'email'] }, ['Kaynak modül: HUKUK', 'Değişen alanlar: Ana konu']],
    ['DIS_KAYNAK_GUNCELLE', 'Dış kaynaktan güncellendi', { kaynakModul: 'SOZLESME', degisenAlanlar: ['aciklama', 'nihaiSonTarih'] }, ['Kaynak modül: SOZLESME', 'Değişen alanlar: Açıklama, Nihai son tarih']],
    ['DIS_KAYNAK_IPTAL', 'Dış kaynak tarafından iptal edildi', { kaynakModul: 'HUKUK' }, ['Kaynak modül: HUKUK']],
  ])('%s türünü güvenli etiket ve detaylarla biçimlendirir', (islemTuru, label, metadata, details) => {
    expect(formatHistoryEntry({ ...base, islemTuru, yeniDeger: JSON.stringify(metadata) })).toMatchObject({ action: islemTuru, label, details })
  })
})
