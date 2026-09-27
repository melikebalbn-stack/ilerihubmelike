import { describe, expect, it } from 'vitest'
import {
  beklenenAralik,
  pdksTakvimTipi,
  puantajHesapla,
  uygulananMolalar,
  yerel,
  type GecisGirdi,
  type KartOkutamamaGirdi,
  type MesaiGirdi,
  type PuantajGirdi,
  type VardiyaTanim,
} from './puantaj-motor'

// Seed ile aynı tanımlar (prisma/manual-sql/2026-09-27-pdks-faz4-seed.sql)
const BEYAZ: VardiyaTanim = {
  id: 'vb', kod: 'BEYAZ-GUNDUZ', girisSaat: '07:00', cikisSaat: '17:00', gunDonumSaat: '04:00', gecToleransDk: 15, erkenToleransDk: 5,
  molalar: [
    { tur: 'YEMEK', baslangic: '12:00', bitis: '13:00', dusulur: true, departmentId: null },
    { tur: 'CAY', baslangic: '10:00', bitis: '10:15', dusulur: false, departmentId: null },
    { tur: 'CAY', baslangic: '15:00', bitis: '15:15', dusulur: false, departmentId: null },
  ],
}
const MAVI: VardiyaTanim = {
  id: 'vm', kod: 'MAVI-GUNDUZ', girisSaat: '07:00', cikisSaat: '17:00', gunDonumSaat: '04:00', gecToleransDk: 5, erkenToleransDk: 0,
  molalar: [
    { tur: 'CAY', baslangic: '10:00', bitis: '10:15', dusulur: false, departmentId: null },
    { tur: 'CAY', baslangic: '15:00', bitis: '15:15', dusulur: false, departmentId: null },
  ],
}
const GECE: VardiyaTanim = { ...MAVI, id: 'vg', kod: 'MAVI-GECE', girisSaat: '21:00', cikisSaat: '07:00', gunDonumSaat: '12:00' }

const PZT = '2026-09-28' // Pazartesi
const CMT = '2026-10-03' // Cumartesi
const t = (gun: string, hhmmss: string, ekle = 0) => {
  const [h, m, s = '0'] = hhmmss.split(':')
  return new Date(yerel(gun, `${h}:${m}`, ekle).getTime() + Number(s) * 1000)
}
let n = 0
const G = (zaman: Date, yon: 'GIRIS' | 'CIKIS', sensorBagli = true): GecisGirdi => ({ id: `g${++n}`, zaman, yon, sensorBagli })
const gun = (o: Partial<PuantajGirdi> & { gecisler?: GecisGirdi[] }): PuantajGirdi => ({
  gun: PZT, vardiya: BEYAZ, vardiyaKaynak: 'VARSAYILAN', departmentId: 'd-uretim', takvim: 'CALISMA', iseGiris: '2020-01-01',
  gecisler: [], kartFormlari: [], mesaiFormlari: [], ayarlar: { sensorZorunlu: false, yarimGunBitis: '13:00' }, izin: null,
  simdi: new Date('2026-12-01T00:00:00Z'), ...o,
})
const tamGun = (gunStr = PZT, a = '07:00', b = '17:00') => [G(t(gunStr, a), 'GIRIS'), G(t(gunStr, b), 'CIKIS')]

describe('gece vardiyası — gün dönümü', () => {
  it('21:00→07:00 çıkışı başladığı güne yazılır; önceki gecenin çıkışı bu güne girmez', () => {
    const r = puantajHesapla(gun({
      vardiya: GECE,
      gecisler: [
        G(t(PZT, '06:58'), 'CIKIS'), // Pazar gecesinin çıkışı — 27'sine ait (12:00 dönümünden önce)
        G(t(PZT, '21:02'), 'GIRIS'),
        G(t(PZT, '07:01', 1), 'CIKIS'), // Salı 07:01 → Pazartesi vardiya günü
      ],
    }))
    expect(r.durum).toBe('TAM')
    expect(r.ilkGiris).toEqual(t(PZT, '21:02'))
    expect(r.sonCikis).toEqual(t(PZT, '07:01', 1))
    expect(r.beklenenBaslangic).toEqual(t(PZT, '21:00'))
    expect(r.beklenenBitis).toEqual(t(PZT, '07:00', 1))
    expect(r).toMatchObject({ gecDakika: 0, erkenCikisDakika: 0, fiiliDakika: 599, calismaDakika: 598 }) // 07:00–07:01 vardiya dışı
  })
  it('gece vardiyasında gün dönümünden sonraki okutma ertesi vardiya gününe ait', () => {
    const r = puantajHesapla(gun({ vardiya: GECE, gecisler: [G(t(PZT, '12:30', 1), 'GIRIS')] }))
    expect(r.durum).toBe('GELMEDI')
  })
})

describe('tolerans sınırları', () => {
  it('beyaz yaka geç 15: tam 15 dk geç SAYILMAZ, 1 sn fazlası başlamış dakikayla sayılır', () => {
    expect(puantajHesapla(gun({ gecisler: [G(t(PZT, '07:15:00'), 'GIRIS'), G(t(PZT, '17:00'), 'CIKIS')] })).gecDakika).toBe(0)
    expect(puantajHesapla(gun({ gecisler: [G(t(PZT, '07:15:01'), 'GIRIS'), G(t(PZT, '17:00'), 'CIKIS')] })).gecDakika).toBe(16)
  })
  it('mavi yaka geç 5', () => {
    expect(puantajHesapla(gun({ vardiya: MAVI, gecisler: [G(t(PZT, '07:05:00'), 'GIRIS'), G(t(PZT, '17:00'), 'CIKIS')] })).gecDakika).toBe(0)
    expect(puantajHesapla(gun({ vardiya: MAVI, gecisler: [G(t(PZT, '07:05:30'), 'GIRIS'), G(t(PZT, '17:00'), 'CIKIS')] })).gecDakika).toBe(6)
  })
  it('erken çıkış: beyaz 5 (16:55 sınır), mavi 0 (17:00 sınır)', () => {
    expect(puantajHesapla(gun({ gecisler: tamGun(PZT, '07:00', '16:55') })).erkenCikisDakika).toBe(0)
    expect(puantajHesapla(gun({ gecisler: [G(t(PZT, '07:00'), 'GIRIS'), G(t(PZT, '16:54:59'), 'CIKIS')] })).erkenCikisDakika).toBe(6)
    expect(puantajHesapla(gun({ vardiya: MAVI, gecisler: tamGun(PZT, '07:00', '17:00') })).erkenCikisDakika).toBe(0)
    expect(puantajHesapla(gun({ vardiya: MAVI, gecisler: [G(t(PZT, '07:00'), 'GIRIS'), G(t(PZT, '16:59:59'), 'CIKIS')] })).erkenCikisDakika).toBe(1)
  })
})

describe('mola düşme', () => {
  it('beyaz: yemek (12–13) düşülür, çaylar düşülmez → 600 − 60 = 540', () => {
    expect(puantajHesapla(gun({ gecisler: tamGun() }))).toMatchObject({ fiiliDakika: 600, dusulenMolaDakika: 60, calismaDakika: 540 })
  })
  it('yalnız çalışılan aralıkla KESİŞEN kısım düşülür (12:30 çıkış → 30 dk)', () => {
    expect(puantajHesapla(gun({ gecisler: tamGun(PZT, '07:00', '12:30') }))).toMatchObject({ fiiliDakika: 330, dusulenMolaDakika: 30, calismaDakika: 300 })
  })
  it('bölüme özel yemek molası genel satırı EZER; başka bölüme etki etmez', () => {
    const v: VardiyaTanim = { ...MAVI, molalar: [...MAVI.molalar, { tur: 'YEMEK', baslangic: '11:30', bitis: '12:15', dusulur: true, departmentId: 'd-uretim' }] }
    expect(uygulananMolalar(v.molalar, 'd-uretim').map((m) => m.tur)).toEqual(['YEMEK', 'CAY', 'CAY'])
    expect(uygulananMolalar(v.molalar, 'd-idari').map((m) => m.tur)).toEqual(['CAY', 'CAY'])
    expect(puantajHesapla(gun({ vardiya: v, gecisler: tamGun() })).dusulenMolaDakika).toBe(45)
    expect(puantajHesapla(gun({ vardiya: v, departmentId: 'd-idari', gecisler: tamGun() })).dusulenMolaDakika).toBe(0)
  })
})

describe('kart okutamama formu', () => {
  const form = (o: Partial<KartOkutamamaGirdi>): KartOkutamamaGirdi => ({ id: 'kf1', girisSaati: null, cikisSaati: '17:00', onayDurumu: 'ONAYLANDI', ivOnaylandi: true, ...o })

  it('ONAYLANDI + İV onaylı form eksik çıkışı tamamlar → TAM_FORMLA', () => {
    const r = puantajHesapla(gun({ gecisler: [G(t(PZT, '07:00'), 'GIRIS')], kartFormlari: [form({})] }))
    expect(r).toMatchObject({ durum: 'TAM_FORMLA', cikisKaynak: 'FORM', girisKaynak: 'CIHAZ', kartOkutamamaId: 'kf1', calismaDakika: 540 })
    expect(r.sonCikis).toEqual(t(PZT, '17:00'))
  })
  it('İV ONAYSIZ form günü TAMAMLAMAZ (onayDurumu ONAYLANDI olsa bile)', () => {
    const r = puantajHesapla(gun({ gecisler: [G(t(PZT, '07:00'), 'GIRIS')], kartFormlari: [form({ ivOnaylandi: false })] }))
    expect(r).toMatchObject({ durum: 'EKSIK_CIKIS', cikisKaynak: null, kartOkutamamaId: null })
    expect(r.uyarilar).toContain('KART_OKUTAMAMA_ONAY_BEKLIYOR')
  })
  it('müdür onayı BEKLIYOR + İV onaylı da tamamlamaz; reddedilen form uyarı üretmez', () => {
    expect(puantajHesapla(gun({ gecisler: [G(t(PZT, '07:00'), 'GIRIS')], kartFormlari: [form({ onayDurumu: 'BEKLIYOR' })] })).durum).toBe('EKSIK_CIKIS')
    const red = puantajHesapla(gun({ gecisler: [G(t(PZT, '07:00'), 'GIRIS')], kartFormlari: [form({ onayDurumu: 'REDDEDILDI' })] }))
    expect(red.uyarilar).not.toContain('KART_OKUTAMAMA_ONAY_BEKLIYOR')
  })
  it('hiç okutma yoksa form her iki tarafı tamamlar; cihaz okutması varsa cihaz kazanır (uyarı)', () => {
    expect(puantajHesapla(gun({ kartFormlari: [form({ girisSaati: '07:10', cikisSaati: '17:00' })] }))).toMatchObject({ durum: 'TAM_FORMLA', girisKaynak: 'FORM', cikisKaynak: 'FORM' })
    const c = puantajHesapla(gun({ gecisler: tamGun(PZT, '07:40', '17:00'), kartFormlari: [form({ girisSaati: '07:00' })] }))
    expect(c).toMatchObject({ durum: 'TAM', girisKaynak: 'CIHAZ', gecDakika: 40 })
    expect(c.uyarilar).toEqual(expect.arrayContaining(['FORM_CIHAZ_CELISKI_GIRIS', 'FORM_CIHAZ_CELISKI_CIKIS']))
  })
  it('gece vardiyası formu: 07:00 çıkış saati vardiya gününün ertesi sabahına yerleşir', () => {
    const r = puantajHesapla(gun({ vardiya: GECE, gecisler: [G(t(PZT, '21:00'), 'GIRIS')], kartFormlari: [form({ cikisSaati: '07:00' })] }))
    expect(r.sonCikis).toEqual(t(PZT, '07:00', 1))
    expect(r.durum).toBe('TAM_FORMLA')
  })
})

describe('onaylı mesai formu', () => {
  const aksam: MesaiGirdi = { overtimePersonnelId: 'op1', isFullDay: false, startTime: '17:00', endTime: '20:30' }
  it('akşam mesaisi: gün normal hesaplanır, form süresi (210) ayrıca eklenir; fiili yanında', () => {
    const r = puantajHesapla(gun({ gecisler: tamGun(PZT, '07:00', '20:32'), mesaiFormlari: [aksam] }))
    expect(r).toMatchObject({ durum: 'TAM', onayliMesaiDakika: 210, mesaiPersonelId: 'op1', fiiliDakika: 812, erkenCikisDakika: 0, fazlaDakika: 212, calismaDakika: 540 + 210 })
    expect(r.uyarilar).not.toContain('ONAYSIZ_FAZLA')
  })
  it('form yokken 30 dk üstü fazla kalış ONAYSIZ_FAZLA uyarısı; vardiya dışı süre çalışmaya EKLENMEZ', () => {
    const r = puantajHesapla(gun({ gecisler: tamGun(PZT, '07:00', '20:32') }))
    expect(r.uyarilar).toContain('ONAYSIZ_FAZLA')
    expect(r).toMatchObject({ fiiliDakika: 812, calismaDakika: 540 })
  })
  it('erken gelme (06:30) çalışma sayılmaz, fiili yanında görünür', () => {
    expect(puantajHesapla(gun({ gecisler: tamGun(PZT, '06:30', '17:00') }))).toMatchObject({ fiiliDakika: 630, calismaDakika: 540, gecDakika: 0 })
  })
  it('Cumartesi saatsiz tam gün form: MESAI, süre = vardiya − düşülen mola (540); fiili turnike yanında', () => {
    const r = puantajHesapla(gun({
      gun: CMT, takvim: 'HAFTA_SONU', gecisler: tamGun(CMT, '07:05', '16:40'),
      mesaiFormlari: [{ overtimePersonnelId: 'op2', isFullDay: true, startTime: null, endTime: null }],
    }))
    expect(r).toMatchObject({ durum: 'MESAI', onayliMesaiDakika: 540, calismaDakika: 540, fiiliDakika: 575, mesaiPersonelId: 'op2' })
  })
  it('Cumartesi formsuz: HAFTA_SONU; okutma varsa uyarı ama çalışma sayılmaz', () => {
    const r = puantajHesapla(gun({ gun: CMT, takvim: 'HAFTA_SONU', gecisler: tamGun(CMT) }))
    expect(r).toMatchObject({ durum: 'HAFTA_SONU', calismaDakika: null })
    expect(r.uyarilar).toContain('ONAYSIZ_GUNDE_GECIS')
  })
})

describe('tatil + yarım gün', () => {
  it('pdksTakvimTipi: Cmt/Paz hafta sonu; TATIL; YARIM; IproTatil MESAI tipi YOK SAYILIR', () => {
    expect(pdksTakvimTipi(PZT, null)).toBe('CALISMA')
    expect(pdksTakvimTipi(CMT, null)).toBe('HAFTA_SONU')
    expect(pdksTakvimTipi('2026-10-04', null)).toBe('HAFTA_SONU') // Pazar
    expect(pdksTakvimTipi('2026-10-29', 'TATIL')).toBe('TATIL')
    expect(pdksTakvimTipi('2026-10-28', 'YARIM')).toBe('YARIM')
    expect(pdksTakvimTipi(PZT, 'MESAI')).toBe('CALISMA')
    expect(pdksTakvimTipi(CMT, 'MESAI')).toBe('HAFTA_SONU')
  })
  it('TATIL günü formsuz → TATIL', () => {
    expect(puantajHesapla(gun({ takvim: 'TATIL' })).durum).toBe('TATIL')
  })
  it('YARIM gün: beklenen bitiş 13:00; 13:00 çıkış tam, 12:50 çıkış (beyaz tol 5) erken 10', () => {
    const r = puantajHesapla(gun({ takvim: 'YARIM', gecisler: tamGun(PZT, '07:00', '13:00') }))
    expect(r.beklenenBitis).toEqual(t(PZT, '13:00'))
    expect(r).toMatchObject({ durum: 'TAM', erkenCikisDakika: 0 })
    expect(puantajHesapla(gun({ takvim: 'YARIM', gecisler: tamGun(PZT, '07:00', '12:50') })).erkenCikisDakika).toBe(10)
  })
})

describe('diğer kurallar', () => {
  it('hiç okutma yok → GELMEDI + IZIN_BILGISI_YOK; izin kaynağı izinli derse BEKLENMIYOR', () => {
    expect(puantajHesapla(gun({})).uyarilar).toContain('IZIN_BILGISI_YOK')
    expect(puantajHesapla(gun({ izin: { izinli: true, tur: 'YILLIK' } }))).toMatchObject({ durum: 'BEKLENMIYOR', uyarilar: ['IZINLI:YILLIK'] })
  })
  it('sensör zorunluyken yalnız sensöre bağlı okutmalar sayılır', () => {
    const gecisler = [G(t(PZT, '07:00'), 'GIRIS', false), G(t(PZT, '07:20'), 'GIRIS', true), G(t(PZT, '17:00'), 'CIKIS', true)]
    expect(puantajHesapla(gun({ gecisler })).ilkGiris).toEqual(t(PZT, '07:00'))
    const z = puantajHesapla(gun({ gecisler, ayarlar: { sensorZorunlu: true, yarimGunBitis: '13:00' } }))
    expect(z.ilkGiris).toEqual(t(PZT, '07:20'))
    expect(z.uyarilar).toContain('SENSORSUZ_OKUTMA_SAYILMADI:1')
  })
  it('işe girişten önceki gün BEKLENMIYOR; gün sürüyorsa EKSIK_CIKIS + GUN_SURUYOR', () => {
    expect(puantajHesapla(gun({ iseGiris: '2026-09-29' })).durum).toBe('BEKLENMIYOR')
    const s = puantajHesapla(gun({ gecisler: [G(t(PZT, '07:00'), 'GIRIS')], simdi: t(PZT, '11:00') }))
    expect(s.durum).toBe('EKSIK_CIKIS')
    expect(s.uyarilar).toContain('GUN_SURUYOR')
  })
  it('beklenenAralik gece için ertesi güne taşar', () => {
    expect(beklenenAralik(PZT, GECE)).toEqual({ bas: t(PZT, '21:00'), bit: t(PZT, '07:00', 1) })
  })
})
