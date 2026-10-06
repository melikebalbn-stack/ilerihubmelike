import { describe, it, expect } from 'vitest'
import {
  transferGorevKarari,
  talepKoltukOzeti,
  koltukRozeti,
  koltukUyumsuzlugu,
} from './bolum-talep-gorev'

// 06.10.2026 · ILR-00925 (BDT-2026-001) vakası: bölüm transferi uygulandı,
// Personnel.bolum/departmentId doğru yazıldı, ama görev eski bölümün unvanında
// kaldığı için koltuk eşleşmesi ({bolum, gorev} çifti) hedef bölümde aday kutu
// bulamadı → koltuk taşınmadı ve bu yalnız denetim kaydına düştü (5 gün fark
// edilmedi). Bu testler kuralı sabitler.

describe('transferGorevKarari · görev güncellenecek mi', () => {
  it('görev SEÇİLMİŞ (hedef bölümde boş kutu unvanı) → güncellenir', () => {
    expect(transferGorevKarari({ yeniGorev: 'CNC TORNA OPERATÖRÜ', mevcutGorev: 'YARI MAMUL VE HAMMADDE DEPO OPERATÖRÜ' }))
      .toEqual({ guncellenecek: true, deger: 'CNC TORNA OPERATÖRÜ' })
  })

  it('görev SEÇİLMEMİŞ → dokunulmaz (06.10 öncesi davranış korunur)', () => {
    expect(transferGorevKarari({ yeniGorev: null, mevcutGorev: 'DEPO OPERATÖRÜ' }))
      .toEqual({ guncellenecek: false, deger: null })
    expect(transferGorevKarari({ yeniGorev: '', mevcutGorev: 'DEPO OPERATÖRÜ' }))
      .toEqual({ guncellenecek: false, deger: null })
    expect(transferGorevKarari({ yeniGorev: '   ', mevcutGorev: 'DEPO OPERATÖRÜ' }))
      .toEqual({ guncellenecek: false, deger: null })
  })

  it('seçilen görev mevcutla AYNI → gereksiz yazma yapılmaz', () => {
    expect(transferGorevKarari({ yeniGorev: 'CNC TORNA OPERATÖRÜ', mevcutGorev: 'CNC TORNA OPERATÖRÜ' }))
      .toEqual({ guncellenecek: false, deger: null })
  })

  it('mevcut görev boşsa seçilen görev yazılır', () => {
    expect(transferGorevKarari({ yeniGorev: 'CNC TORNA OPERATÖRÜ', mevcutGorev: null }))
      .toEqual({ guncellenecek: true, deger: 'CNC TORNA OPERATÖRÜ' })
  })
})

describe('talepKoltukOzeti · talebe yazılan koltuk sonucu', () => {
  it('görev seçilmiş + kutu boş → taşındı, sebep yok', () => {
    expect(talepKoltukOzeti({ tasindi: true })).toEqual({ koltukTasindi: true, koltukSebep: null })
  })

  it('seçilen kutu bu arada DOLMUŞ → taşınmadı, sebep kaydedilir', () => {
    // Koltuk helper'ının gerçek sebebi (pozisyonEslesmesiBul).
    expect(talepKoltukOzeti({ tasindi: false, sebep: 'bos kadro yok (7 aday, hepsi dolu)' }))
      .toEqual({ koltukTasindi: false, koltukSebep: 'bos kadro yok (7 aday, hepsi dolu)' })
  })

  it('hedef bölümde o unvanda kutu YOK (görev seçilmedi) → ILR-00925 vakasının sebebi', () => {
    expect(talepKoltukOzeti({ tasindi: false, sebep: 'bolum uyusmuyor (personel bolumu: Talaşlı İmalat)' }))
      .toEqual({ koltukTasindi: false, koltukSebep: 'bolum uyusmuyor (personel bolumu: Talaşlı İmalat)' })
  })

  it('taşıma olmadı ama koltuk AÇILDI → tamam sayılır', () => {
    expect(talepKoltukOzeti({ tasindi: false, sebep: 'semada ana koltugu yok', acildi: true }))
      .toEqual({ koltukTasindi: true, koltukSebep: null })
  })

  it('sebep bildirilmediyse boş bırakılmaz', () => {
    expect(talepKoltukOzeti({ tasindi: false })).toEqual({
      koltukTasindi: false,
      koltukSebep: 'sebep bildirilmedi',
    })
  })
})

describe('koltukRozeti · İV listesindeki uyarı', () => {
  it('ONAYLANDI + koltuk taşınmadı → rozet GÖRÜNÜR', () => {
    expect(koltukRozeti({ durum: 'ONAYLANDI', koltukTasindi: false })).toEqual({
      gorunur: true,
      metin: 'şema koltuğu taşınmadı',
    })
  })

  it('ONAYLANDI + koltuk taşındı → rozet YOK', () => {
    expect(koltukRozeti({ durum: 'ONAYLANDI', koltukTasindi: true }).gorunur).toBe(false)
  })

  it('BEKLIYOR → koltuk hiç denenmedi, rozet YOK', () => {
    expect(koltukRozeti({ durum: 'BEKLIYOR', koltukTasindi: null }).gorunur).toBe(false)
  })

  it('REDDEDILDI / IPTAL → rozet YOK (transfer uygulanmadı)', () => {
    expect(koltukRozeti({ durum: 'REDDEDILDI', koltukTasindi: null }).gorunur).toBe(false)
    expect(koltukRozeti({ durum: 'IPTAL', koltukTasindi: null }).gorunur).toBe(false)
  })

  it('eski kayıtlarda koltukTasindi NULL → rozet YOK (geriye uyum, backfill yapılmadı)', () => {
    expect(koltukRozeti({ durum: 'ONAYLANDI', koltukTasindi: null }).gorunur).toBe(false)
  })
})

describe('koltukUyumsuzlugu · personel kartı uyarısı', () => {
  it('koltuk başka bölümde → uyarı (ILR-00925 01.10–06.10 arası durumu)', () => {
    const s = koltukUyumsuzlugu({
      personelBolumu: 'Talaşlı İmalat',
      koltukBolumu: 'Yarı Mamul ve Hammadde Depo',
    })
    expect(s.uyumsuz).toBe(true)
    expect(s.mesaj).toContain('Yarı Mamul ve Hammadde Depo')
    expect(s.mesaj).toContain('Talaşlı İmalat')
  })

  it('aynı bölüm → uyarı YOK', () => {
    expect(koltukUyumsuzlugu({ personelBolumu: 'Talaşlı İmalat', koltukBolumu: 'Talaşlı İmalat' }).uyumsuz).toBe(false)
  })

  it('koltuk yok ya da bölüm bağı çözülemiyor → bu uyarının konusu DEĞİL', () => {
    expect(koltukUyumsuzlugu({ personelBolumu: 'Talaşlı İmalat', koltukBolumu: null }).uyumsuz).toBe(false)
    expect(koltukUyumsuzlugu({ personelBolumu: null, koltukBolumu: 'Talaşlı İmalat' }).uyumsuz).toBe(false)
  })
})
