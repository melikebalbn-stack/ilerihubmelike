// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { kisiBakiyeOzeti, kidemSuresi } from './bakiye-ozet'
import { acilisExcelOku, acilisKapisi, acilisRaporYaz, acilisSiniflandir, kalanCoz, sicilNormalize, type HubKisi } from './acilis-import'
import { hakEdisPlani, type HakEdisKisi } from './hak-edis-isi'

const xlsx = (satirlar: unknown[][]) => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(satirlar), 'Sayfa1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('kişi bakiye özeti (Bakiyeler ekranı)', () => {
  const temel = { bekleyenGunler: [] as number[], donemler: [], dogumTarihi: null, aktif: true }

  it('kıdem: tamamlanan yıl ve ay; 1 yıl dolmadan yıllık hak yok, sonraki = ilk hak', () => {
    expect(kidemSuresi('2021-03-15', '2026-09-27')).toEqual({ yil: 5, ay: 6 })
    const o = kisiBakiyeOzeti({ ...temel, defter: [], iseGirisTarihi: '2026-06-16', bugun: '2026-09-27' })
    expect([o.kidemYil, o.kidemAy, o.yillikHak]).toEqual([0, 3, null])
    expect(o.sonraki).toEqual({ tarih: '2027-06-16', gun: 14, ilk: true })
  })

  it('kalan = bakiye − bekleyen; kullanılan yalnız bu yıl (iade düşülmüş); sonraki yıldönümü 6. yıl → 20', () => {
    const o = kisiBakiyeOzeti({
      ...temel,
      iseGirisTarihi: '2021-03-15',
      bekleyenGunler: [3.5, 1],
      bugun: '2026-09-27',
      defter: [
        { hareket: 'ACILIS', gun: 12, tarih: '2025-12-31' },
        { hareket: 'KULLANIM', gun: -2, tarih: '2025-12-31' }, // geçen yıl — sayılmaz
        { hareket: 'HAK_EDIS', gun: 14, tarih: '2026-03-15' },
        { hareket: 'KULLANIM', gun: -5, tarih: '2026-07-01' },
        { hareket: 'IPTAL_IADE', gun: 1.5, tarih: '2026-07-02' },
        { hareket: 'KULLANIM', gun: -1, tarih: '2026-12-01' }, // ileri tarihli — bugüne kadar değil
      ],
    })
    expect(o.bakiye).toBe(20.5)
    expect(o.bekleyen).toBe(4.5)
    expect(o.kalan).toBe(16)
    expect(o.kullanilanBuYil).toBe(3.5)
    expect(o.yillikHak).toBe(14)
    expect(o.sonraki).toEqual({ tarih: '2027-03-15', gun: 20, ilk: false })
  })

  it('yaş kuralı süreye uygulanır ama çıktıda YAŞ/doğum alanı YOK; ayrılan kişide sonraki yok', () => {
    const o = kisiBakiyeOzeti({ ...temel, defter: [], iseGirisTarihi: '2024-02-02', dogumTarihi: '1975-01-10', bugun: '2026-09-27' })
    expect(o.yillikHak).toBe(20) // 2 yıl kıdem → 14, 51 yaş → 20
    expect(JSON.stringify(o)).not.toMatch(/yas|dogum|1975/i)
    expect(kisiBakiyeOzeti({ ...temel, defter: [], iseGirisTarihi: '2024-02-02', aktif: false, bugun: '2026-09-27' }).sonraki).toBeNull()
  })
})

describe('açılış import — değer ve Excel okuma', () => {
  it('kalan: 0,5 katı, negatif/metin/boş/aşırı reddedilir', () => {
    expect(kalanCoz('12')).toEqual({ gun: 12 })
    expect(kalanCoz('12,5')).toEqual({ gun: 12.5 })
    expect(kalanCoz('0')).toEqual({ gun: 0 })
    for (const k of ['', '-1', '3,25', 'on iki', '401']) expect('hata' in kalanCoz(k)).toBe(true)
  })

  it('başlık satırı "Sicil"den bulunur; kalan sütunu "Kalan"; sayı hücresi ve metin hücresi okunur', () => {
    const buf = xlsx([
      ['İLERİ — Yıllık izin devir listesi'],
      [],
      ['Sicil No', 'Ad Soyad', 'Hak edilen', 'Kalan izin (gün)'],
      ['ILR-00001', 'A', 20, 12],
      ['ilr 00002', 'B', 14, '7,5'],
      [null, 'toplam', null, 19.5],
    ])
    const r = acilisExcelOku(buf)
    expect(r.baslikSatiri).toBe(3)
    expect(r.kalanSutunu).toBe('Kalan izin (gün)')
    expect(r.satirlar).toEqual([
      { satir: 4, sicil: 'ILR-00001', degerHam: '12' },
      { satir: 5, sicil: 'ILR-00002', degerHam: '7,5' },
    ])
  })

  it('kalan/bakiye sütunu yoksa görülen başlıklarla hata', () => {
    expect(() => acilisExcelOku(xlsx([['Sicil', 'Ad', 'Gün']]))).toThrow(/Kalan.*Sicil \| Ad \| Gün/i)
  })
})

describe('açılış import — sınıflandırma ve kapı', () => {
  const p = (id: string, sicil: string, aktif = true): HubKisi => ({ id, sicilNo: sicil, adSoyad: id.toUpperCase(), aktif, departman: null })
  const hub = [p('a', 'ILR-00001'), p('b', 'ILR-00002'), p('c', 'ILR-00003', false), p('d', 'ILR-00004'), p('e', 'ILR-00005'), p('f', 'ILR-00006')]

  it('her sınıf; Hub aktif ama dosyada olmayan listelenir; toplam gün yalnız yazılacaklardan', () => {
    const r = acilisSiniflandir(
      [
        { satir: 2, sicil: 'ILR-00001', degerHam: '12' },
        { satir: 3, sicil: 'ILR-00002', degerHam: '3,5' },
        { satir: 4, sicil: 'ILR-00003', degerHam: '5' },
        { satir: 5, sicil: 'ILR-09999', degerHam: '5' },
        { satir: 6, sicil: 'ILR-00004', degerHam: '1' },
        { satir: 7, sicil: 'ILR-00004', degerHam: '2' },
        { satir: 8, sicil: 'ILR-00005', degerHam: '-1' },
      ],
      hub,
      new Set(['b']),
    )
    expect(r.kayitlar.map((k) => k.sinif)).toEqual(['ESLESEN', 'ZATEN_VAR', 'HUBDA_PASIF', 'HUBDA_YOK', 'MUKERRER_SICIL', 'MUKERRER_SICIL', 'GECERSIZ_DEGER'])
    expect(r.toplamGun).toBe(12)
    expect(r.hubAktifDosyadaYok.map((x) => x.id)).toEqual(['f'])
    expect(r.eslesmeyen).toEqual({ pay: 5, payda: 7, oran: 5 / 7 })
    expect(acilisKapisi(r, 0.1)).toMatch(/eşleşmeyen oranı/)
  })

  it('temiz dosya kapıdan geçer; yazılacak yoksa durur', () => {
    const r = acilisSiniflandir([{ satir: 2, sicil: 'ILR-00001', degerHam: '12' }], hub, new Set())
    expect(acilisKapisi(r, 0.1)).toBeNull()
    expect(acilisKapisi(acilisSiniflandir([{ satir: 2, sicil: 'ILR-00001', degerHam: '12' }], hub, new Set(['a'])), 0.1)).toBe('yazılacak satır yok')
    expect(sicilNormalize(' ilr00007 ')).toBe('ILR-00007')
  })

  it('rapor 600 izinle yazılır; public/ altına yazmayı reddeder', () => {
    const r = acilisSiniflandir([{ satir: 2, sicil: 'ILR-00001', degerHam: '12' }], hub, new Set())
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'izin-acilis-'))
    const { csv, json } = acilisRaporYaz(path.join(dizin, 'uploads', 'izin'), r, { mod: 'DRY-RUN' }, 'test')
    expect(fs.statSync(csv).mode & 0o777).toBe(0o600)
    expect(fs.statSync(json).mode & 0o777).toBe(0o600)
    expect(fs.readFileSync(csv, 'utf8')).toContain('HUB_AKTIF_DOSYADA_YOK')
    expect(() => acilisRaporYaz(path.join(dizin, 'public', 'uploads'), r, {}, 'x')).toThrow(/public/)
    fs.rmSync(dizin, { recursive: true, force: true })
  })
})

describe('hak ediş işi planı', () => {
  const k = (o: Partial<HakEdisKisi> = {}): HakEdisKisi => ({ personnelId: 'p', iseGirisTarihi: '2021-10-01', donemler: [], dogumTarihi: null, acilisTarihi: null, ...o })

  it('geçiş tarihine kadarki (dahil) yıldönümü yazılmaz — Excel\'de sayılmış', () => {
    expect(hakEdisPlani([k({ iseGirisTarihi: '2021-10-01' })], { bugun: '2026-10-01', geriGun: 7, gecisTarihi: '2026-10-01' })).toEqual([])
    const r = hakEdisPlani([k({ iseGirisTarihi: '2021-10-02' })], { bugun: '2026-10-02', geriGun: 7, gecisTarihi: '2026-10-01' })
    expect(r).toEqual([{ personnelId: 'p', tarih: '2026-10-02', kidemYil: 5, gun: 14, anahtar: 'HAK:p:2026' }])
  })

  it('pencere: bugünden geriGun kadar geriye (kaçan gün yakalanır), ileri tarih yazılmaz', () => {
    const kisi = [k({ iseGirisTarihi: '2020-09-25' })]
    expect(hakEdisPlani(kisi, { bugun: '2026-09-27', geriGun: 7, gecisTarihi: '2026-01-01' }).map((h) => [h.tarih, h.gun])).toEqual([['2026-09-25', 20]])
    expect(hakEdisPlani(kisi, { bugun: '2026-09-27', geriGun: 1, gecisTarihi: '2026-01-01' })).toEqual([])
    expect(hakEdisPlani(kisi, { bugun: '2026-09-24', geriGun: 7, gecisTarihi: '2026-01-01' })).toEqual([])
  })

  it('kişinin açılışı geçişten sonra yüklendiyse o tarihe kadarki yıldönümü de yazılmaz; 1 yıl dolmadan 0 yazılmaz', () => {
    const kisi = k({ iseGirisTarihi: '2020-09-25', acilisTarihi: '2026-09-26' })
    expect(hakEdisPlani([kisi], { bugun: '2026-09-27', geriGun: 7, gecisTarihi: '2026-01-01' })).toEqual([])
    expect(hakEdisPlani([k({ iseGirisTarihi: '2026-01-15' })], { bugun: '2026-09-27', geriGun: 31, gecisTarihi: '2026-01-01' })).toEqual([])
  })
})
