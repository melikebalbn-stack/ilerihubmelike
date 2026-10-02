import { describe, it, expect } from 'vitest'
import { FifDurum, FifSonuc } from '@/generated/prisma'
import {
  gecisYapabilirMi, uygunGecisler, altKayitDuzenlenebilir, esKuraliGecerli, esGecmisAciklamasi, hardDeleteEdilebilir, yeniAkisMi,
  kokNedenDoluMu, faaliyetPlanlamaYetkisi, type FifGecisState, type FifGecisCtx,
} from './fif-durum'
import { fifOlayEtiketi } from './fif-durum-etiket'

const HAZIRLAYAN = 'uHazir'
const YAYINLAYAN = 'uYayin'
const SORUMLU_ONAY = 'uSorumluOnay'
const IZLEME = 'uIzleme'
const MUDUR = 'uMudur'
const KSS = 'uKss'
const YABANCI = 'uYabanci'

function baseState(over: Partial<FifGecisState> = {}): FifGecisState {
  return {
    durum: FifDurum.TASLAK,
    createdById: HAZIRLAYAN,
    hazirlayanUserId: HAZIRLAYAN,
    yayinlayanOnaylayanUserId: YAYINLAYAN,
    sorumluOnaylayanUserId: SORUMLU_ONAY,
    izlemeSorumlusuUserId: IZLEME,
    sorumluBolumId: 'dept1',
    yayinlayanBolumId: 'dept2',
    uygunsuzlukTanimi: 'Tespit metni',
    tur: 'DUZELTICI',
    faaliyetler: [],
    etkinlikler: [],
    ...over,
  }
}
const ctx = (userId: string | null, isManage = false, mudur: string | null = MUDUR): FifGecisCtx => ({ userId, isManage, sorumluBolumMudurUserId: mudur })
/** KSS koltuğundaki kullanıcı bağlamı (KSS adımları için). */
const kssCtx = (userId: string | null = KSS): FifGecisCtx => ({ userId, isManage: false, sorumluBolumMudurUserId: MUDUR, isKss: true })

describe('fif-durum — TASLAK → KSS_KAYIT_BEKLIYOR ("Onaya Gönder", Paket 2: müdür onayı yok)', () => {
  it('hazırlayan gönderebilir → doğrudan KSS kaydına düşer', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), baseState(), FifDurum.KSS_KAYIT_BEKLIYOR).ok).toBe(true)
  })
  it('yeni kayıt ONAY_BEKLIYOR\'a GİREMEZ', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), baseState(), FifDurum.ONAY_BEKLIYOR).ok).toBe(false)
  })
  it('yabancı gönderemez', () => {
    expect(gecisYapabilirMi(ctx(YABANCI), baseState(), FifDurum.KSS_KAYIT_BEKLIYOR).ok).toBe(false)
  })
  it('zorunlu alan eksikse (tespit boş) reddeder', () => {
    const r = gecisYapabilirMi(ctx(HAZIRLAYAN), baseState({ uygunsuzlukTanimi: '' }), FifDurum.KSS_KAYIT_BEKLIYOR)
    expect(r.ok).toBe(false)
  })
  it('manage da gönderebilir', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), baseState(), FifDurum.KSS_KAYIT_BEKLIYOR).ok).toBe(true)
  })
})

describe('fif-durum — ESKİ AKIŞ: ONAY_BEKLIYOR → KSS_KAYIT_BEKLIYOR / TASLAK(red) (takılı kalmasın)', () => {
  const st = () => baseState({ durum: FifDurum.ONAY_BEKLIYOR })
  it('yayınlayan onaylayan onaylar → KSS kaydına düşer', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), st(), FifDurum.KSS_KAYIT_BEKLIYOR).ok).toBe(true)
  })
  it('onaydan doğrudan FAALIYET\'e ATLANAMAZ (KSS adımı zorunlu)', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), st(), FifDurum.FAALIYET).ok).toBe(false)
  })
  it('hazırlayan onaylayamaz', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), st(), FifDurum.KSS_KAYIT_BEKLIYOR).ok).toBe(false)
  })
  it('yayınlayan reddeder (→TASLAK)', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), st(), FifDurum.TASLAK).ok).toBe(true)
  })
  it('yabancı reddedemez', () => {
    expect(gecisYapabilirMi(ctx(YABANCI), st(), FifDurum.TASLAK).ok).toBe(false)
  })
})

describe('fif-durum — FAALIYET → KAPATMA_BEKLIYOR ("Kapatmaya Gönder")', () => {
  const kapali = { hedefTarih: new Date(), sonuc: 'K', gerceklesenTarih: new Date(), parafUserId: 'uParaf' }
  const acik = { hedefTarih: new Date(), sonuc: null, gerceklesenTarih: null, parafUserId: null }
  const st = (faaliyetler: FifGecisState['faaliyetler']) => baseState({ durum: FifDurum.FAALIYET, faaliyetler })
  it('izleme sorumlusu gönderir (tüm satırlar kapalı)', () => {
    expect(gecisYapabilirMi(ctx(IZLEME), st([kapali, kapali]), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(true)
  })
  it('sorumlu bölüm müdürü de gönderir', () => {
    expect(gecisYapabilirMi(ctx(MUDUR), st([kapali]), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(true)
  })
  it('yabancı gönderemez — red türü YETKİ (API 403)', () => {
    const r = gecisYapabilirMi(ctx(YABANCI), st([kapali]), FifDurum.KAPATMA_BEKLIYOR)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.tur).toBe('yetki')
  })
  it('faaliyet yoksa ön koşul patlar', () => {
    expect(gecisYapabilirMi(ctx(IZLEME), st([]), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(false)
  })
  it('Kalite kararı: AÇIK satır varsa "Tüm faaliyetler kapatılmalı" — red türü KOŞUL (API 400)', () => {
    const r = gecisYapabilirMi(ctx(IZLEME), st([kapali, acik]), FifDurum.KAPATMA_BEKLIYOR)
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.sebep).toBe('Tüm faaliyetler kapatılmalı'); expect(r.tur).toBe('kosul') }
  })
  it('K + gerçekleşen var ama PARAF yoksa kapalı SAYILMAZ (KSS "Sonuç Gir" ile kapatılmamış)', () => {
    const r = gecisYapabilirMi(ctx(IZLEME), st([{ ...kapali, parafUserId: null }]), FifDurum.KAPATMA_BEKLIYOR)
    expect(r.ok).toBe(false)
  })
  it('red sonrası yeni eklenen (açık) satır kapatılmadan tekrar gönderilemez', () => {
    expect(gecisYapabilirMi(ctx(IZLEME), st([kapali, kapali, acik]), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(false)
  })
  it('Paket 4: YT (yapılamadı) satır AÇIKTIR → gönderilemez', () => {
    const yt = { ...acik, sonuc: 'YT' }
    expect(gecisYapabilirMi(ctx(IZLEME), st([kapali, yt]), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(false)
  })
  it('açık satırda buton PASİF + sebep döner (yetkiliye); yetkisize hiç dönmez', () => {
    const g = uygunGecisler(ctx(IZLEME), st([acik])).find((x) => x.hedef === FifDurum.KAPATMA_BEKLIYOR)
    expect(g?.pasifSebep).toBe('Tüm faaliyetler kapatılmalı')
    expect(uygunGecisler(ctx(YABANCI), st([acik])).find((x) => x.hedef === FifDurum.KAPATMA_BEKLIYOR)).toBe(undefined)
  })
  it('tüm satırlar kapalıyken buton AKTİF (pasifSebep yok)', () => {
    const g = uygunGecisler(ctx(IZLEME), st([kapali])).find((x) => x.hedef === FifDurum.KAPATMA_BEKLIYOR)
    expect(g?.pasifSebep).toBe(undefined)
  })
})

describe('fif-durum — "Onaya Gönder": yayınlayan bölüm ZORUNLU (Kalite kararı)', () => {
  it('yayınlayan bölüm boşsa gönderilemez — red türü KOŞUL (API 400)', () => {
    const r = gecisYapabilirMi(ctx(HAZIRLAYAN), baseState({ yayinlayanBolumId: null }), FifDurum.KSS_KAYIT_BEKLIYOR)
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.sebep).toBe('Yayınlayan bölüm zorunlu'); expect(r.tur).toBe('kosul') }
  })
  it('yayınlayan bölüm doluysa gönderilir', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), baseState(), FifDurum.KSS_KAYIT_BEKLIYOR).ok).toBe(true)
  })
})

describe('fif-durum — yeniAkisMi (satır bazlı etkinlik ayrımı)', () => {
  it('tüm satırlarda etkinlik planı dolu → yeni akış', () => {
    expect(yeniAkisMi({ faaliyetler: [{ hedefTarih: null, etkinlikPlanTarihi: new Date() }, { hedefTarih: null, etkinlikPlanTarihi: new Date() }] })).toBe(true)
  })
  it('bir satırda plan yok → eski akış', () => {
    expect(yeniAkisMi({ faaliyetler: [{ hedefTarih: null, etkinlikPlanTarihi: new Date() }, { hedefTarih: null, etkinlikPlanTarihi: null }] })).toBe(false)
  })
  it('satırsız FİF / alan verilmemiş (eski çağıran) → eski akış', () => {
    expect(yeniAkisMi({ faaliyetler: [] })).toBe(false)
    expect(yeniAkisMi({ faaliyetler: [{ hedefTarih: null }] })).toBe(false)
  })
})

describe('fif-durum — YENİ AKIŞ: ETKINLIK → KAPANDI "Tamamen Kapat"', () => {
  const plan = new Date('2026-12-28T00:00:00.000Z')
  const st = (uygunlar: (boolean | null)[]) => baseState({
    durum: FifDurum.ETKINLIK,
    faaliyetler: uygunlar.map((u) => ({ hedefTarih: null, etkinlikPlanTarihi: plan, etkinlikUygun: u })),
  })
  it('KSS, tüm satırlar uygun → kapatır; etiket "Tamamen Kapat"', () => {
    expect(gecisYapabilirMi(kssCtx(), st([true, true]), FifDurum.KAPANDI).ok).toBe(true)
    const g = uygunGecisler(kssCtx(), st([true, true])).find((x) => x.hedef === FifDurum.KAPANDI)
    expect(g?.etiket).toBe('Tamamen Kapat')
  })
  it('bir satır kontrol edilmemiş → kapatılamaz', () => {
    const r = gecisYapabilirMi(kssCtx(), st([true, null]), FifDurum.KAPANDI)
    expect(r.ok).toBe(false)
  })
  it('SADECE KSS: manage kapatamaz (eski akıştaki manage yetkisi yeni akışta yok)', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), st([true, true]), FifDurum.KAPANDI).ok).toBe(false)
  })
  it('FifEtkinlik (eski iki madde) yeni akışta aranmaz', () => {
    expect(gecisYapabilirMi(kssCtx(), { ...st([true]), etkinlikler: [] }, FifDurum.KAPANDI).ok).toBe(true)
  })
  it('ETKINLIK → FAALIYET (tüm satırlar YT) yeni akışta YOK — satır bazlı yeniden açılır', () => {
    expect(gecisYapabilirMi(kssCtx(), st([null]), FifDurum.FAALIYET).ok).toBe(false)
    expect(gecisYapabilirMi(ctx(YABANCI, true), st([null]), FifDurum.FAALIYET).ok).toBe(false)
  })
  it('eski akışta etiket "Kapat (Etkin)" kalır', () => {
    const eski = baseState({
      durum: FifDurum.ETKINLIK, faaliyetler: [{ hedefTarih: null }],
      etkinlikler: [{ madde: 'KAPATMA', uygun: true }, { madde: 'TEKRAR_ETMEME', uygun: true }],
    })
    expect(uygunGecisler(kssCtx(), eski).find((x) => x.hedef === FifDurum.KAPANDI)?.etiket).toBe('Kapat (Etkin)')
  })
})

describe('fif-durum — KAPATMA_BEKLIYOR → KSS_KAPANIS_BEKLIYOR / FAALIYET(red)', () => {
  const st = () => baseState({ durum: FifDurum.KAPATMA_BEKLIYOR })
  it('YAYINLAYAN bölüm müdürü kapatmayı onaylar (FAZ B kararı)', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), st(), FifDurum.KSS_KAPANIS_BEKLIYOR).ok).toBe(true)
  })
  it('sorumlu onaylayan kapatmayı ONAYLAYAMAZ (kendi işini onaylama)', () => {
    expect(gecisYapabilirMi(ctx(SORUMLU_ONAY), st(), FifDurum.KSS_KAPANIS_BEKLIYOR).ok).toBe(false)
  })
  it('yayınlayan reddeder (→FAALIYET)', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), st(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('kapatmadan doğrudan ETKINLIK\'e ATLANAMAZ (KSS kapanış kontrolü zorunlu)', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), st(), FifDurum.ETKINLIK).ok).toBe(false)
  })
  it('izleme sorumlusu bu adımı onaylayamaz', () => {
    expect(gecisYapabilirMi(ctx(IZLEME), st(), FifDurum.KSS_KAPANIS_BEKLIYOR).ok).toBe(false)
  })
})

describe('fif-durum — KSS adımları (FAZ B)', () => {
  const kayit = (over = {}) => baseState({ durum: FifDurum.KSS_KAYIT_BEKLIYOR, ...over })
  const kapanis = (over = {}) => baseState({ durum: FifDurum.KSS_KAPANIS_BEKLIYOR, ...over })

  it('Paket 4: KSS kayda alır → SORUMLU_ATAMA_BEKLIYOR (sorumlu bölüm müdürüne)', () => {
    expect(gecisYapabilirMi(kssCtx(), kayit(), FifDurum.SORUMLU_ATAMA_BEKLIYOR).ok).toBe(true)
    const g = uygunGecisler(kssCtx(), kayit()).find((x) => x.hedef === FifDurum.SORUMLU_ATAMA_BEKLIYOR)
    expect(g?.etiket).toBe('Kayda Al ve Yönlendir')
  })
  it('Paket 4: kayıttan doğrudan FAALIYET\'e ATLANAMAZ (müdür adımı zorunlu)', () => {
    const r = gecisYapabilirMi(kssCtx(), kayit(), FifDurum.FAALIYET)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.tur).toBe('gecersiz')
  })
  it('KSS koltuğundaki HERKES kayda alabilir (biri yeterli)', () => {
    expect(gecisYapabilirMi(kssCtx('uBaskaKss'), kayit(), FifDurum.SORUMLU_ATAMA_BEKLIYOR).ok).toBe(true)
  })
  it('Paket 2: izni olmayan kullanıcı kayda ALAMAZ (eski KSS snapshot\'ı yetki vermez)', () => {
    expect(gecisYapabilirMi(ctx(KSS), kayit(), FifDurum.SORUMLU_ATAMA_BEKLIYOR).ok).toBe(false)
  })
  it('manage KSS adımını YAPAMAZ (fif.manage KSS yerine geçmez)', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), kayit(), FifDurum.SORUMLU_ATAMA_BEKLIYOR).ok).toBe(false)
  })
  it('sorumlu bölüm atanmadan kayda alınamaz', () => {
    const r = gecisYapabilirMi(kssCtx(), kayit({ sorumluBolumId: null }), FifDurum.SORUMLU_ATAMA_BEKLIYOR)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.sebep).toContain('Sorumlu bölüm')
  })
  it('Paket 4 FAIL-CLOSED: sorumlu bölüm müdürü (snapshot) yoksa kayda alınamaz', () => {
    const r = gecisYapabilirMi(kssCtx(), kayit({ sorumluOnaylayanUserId: null }), FifDurum.SORUMLU_ATAMA_BEKLIYOR)
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.sebep).toContain('müdürü bulunamadı'); expect(r.tur).toBe('kosul') }
  })
  it('KSS eksik bilgi görürse TASLAK\'a döndürür', () => {
    expect(gecisYapabilirMi(kssCtx(), kayit(), FifDurum.TASLAK).ok).toBe(true)
  })
  it('kapanış kontrolünü KSS onaylar → ETKINLIK', () => {
    expect(gecisYapabilirMi(kssCtx(), kapanis(), FifDurum.ETKINLIK).ok).toBe(true)
  })
  it('yayılım "var" ama açıklama boşsa kapanış onaylanamaz', () => {
    const r = gecisYapabilirMi(kssCtx(), kapanis({ yayilimVarMi: true, yayilimAciklama: '  ' }), FifDurum.ETKINLIK)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.sebep).toContain('Yayılım')
  })
  it('yayılım açıklaması doluysa geçer', () => {
    expect(gecisYapabilirMi(kssCtx(), kapanis({ yayilimVarMi: true, yayilimAciklama: 'Diğer hatlarda kontrol edildi' }), FifDurum.ETKINLIK).ok).toBe(true)
  })
  it('KSS kapanışı reddederse faaliyete döner', () => {
    expect(gecisYapabilirMi(kssCtx(), kapanis(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('yayınlayan müdür KSS kapanış adımını yapamaz', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), kapanis(), FifDurum.ETKINLIK).ok).toBe(false)
  })
})

describe('fif-durum — ETKINLIK → KAPANDI / FAALIYET (Paket 2: KSS)', () => {
  const uygunEtk = [{ madde: 'KAPATMA', uygun: true }, { madde: 'TEKRAR_ETMEME', uygun: true }]
  it('KSS iki etkinlik uygun ise kapatır', () => {
    const r = gecisYapabilirMi(kssCtx(), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: uygunEtk }), FifDurum.KAPANDI)
    expect(r.ok).toBe(true)
  })
  it('manage da kapatır (eski kural korunur)', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: uygunEtk }), FifDurum.KAPANDI).ok).toBe(true)
  })
  it('KSS/manage olmayan (eski takip sorumlusu dahil) kapatamaz', () => {
    expect(gecisYapabilirMi(ctx(YABANCI), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: uygunEtk }), FifDurum.KAPANDI).ok).toBe(false)
  })
  it('etkinlik uygun değilse KAPANDI reddedilir', () => {
    const r = gecisYapabilirMi(kssCtx(), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: [{ madde: 'KAPATMA', uygun: false }, { madde: 'TEKRAR_ETMEME', uygun: true }] }), FifDurum.KAPANDI)
    expect(r.ok).toBe(false)
  })
  it('etkinlik satırı eksikse KAPANDI reddedilir', () => {
    const r = gecisYapabilirMi(kssCtx(), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: [{ madde: 'KAPATMA', uygun: true }] }), FifDurum.KAPANDI)
    expect(r.ok).toBe(false)
  })
  it('uygun değil → FAALIYET (yeniden aç) KSS\'ye açık', () => {
    expect(gecisYapabilirMi(kssCtx(), baseState({ durum: FifDurum.ETKINLIK }), FifDurum.FAALIYET).ok).toBe(true)
  })
})

describe('fif-durum — IPTAL', () => {
  it('hazırlayan TASLAK\'ta iptal edebilir', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), baseState(), FifDurum.IPTAL).ok).toBe(true)
  })
  it('hazırlayan TASLAK dışında iptal edemez (yalnız manage)', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), baseState({ durum: FifDurum.FAALIYET }), FifDurum.IPTAL).ok).toBe(false)
    expect(gecisYapabilirMi(ctx(YABANCI, true), baseState({ durum: FifDurum.FAALIYET }), FifDurum.IPTAL).ok).toBe(true)
  })
  it('KAPANDI iptal edilemez (manage bile)', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), baseState({ durum: FifDurum.KAPANDI }), FifDurum.IPTAL).ok).toBe(false)
  })
})

describe('fif-durum — Paket 4: SORUMLU_ATAMA_BEKLIYOR → FAALIYET ("Sorumlu Bölüm Onayı")', () => {
  const st = (over: Partial<FifGecisState> = {}) =>
    baseState({ durum: FifDurum.SORUMLU_ATAMA_BEKLIYOR, izlemeSorumlusuUserId: 'uSecilen', faaliyetler: [], ...over })

  it('sorumlu bölüm müdürü (snapshot) izleme sorumlusu seçiliyken onaylar — kök neden / satır ŞARTI YOK', () => {
    expect(gecisYapabilirMi(ctx(SORUMLU_ONAY), st(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('manage de onaylar', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), st(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('izleme sorumlusu seçilmeden onaylanamaz — red türü KOŞUL', () => {
    const r = gecisYapabilirMi(ctx(SORUMLU_ONAY), st({ izlemeSorumlusuUserId: null }), FifDurum.FAALIYET)
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.sebep).toBe('Faaliyet izleme sorumlusu seçilmeli'); expect(r.tur).toBe('kosul') }
  })
  it('KSS / hazırlayan / izleme / yabancı onaylayamaz — red türü YETKİ', () => {
    for (const c of [kssCtx(), ctx(HAZIRLAYAN), ctx(IZLEME), ctx(YABANCI)]) {
      const r = gecisYapabilirMi(c, st(), FifDurum.FAALIYET)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.tur).toBe('yetki')
    }
  })
  it('uygunGecisler: müdüre izleme seçilmemişken de buton döner (etiket "Sorumlu Bölüm Onayı", seçim penceresi)', () => {
    const g = uygunGecisler(ctx(SORUMLU_ONAY), st({ izlemeSorumlusuUserId: null })).find((x) => x.hedef === FifDurum.FAALIYET)
    expect(g).toEqual({ hedef: FifDurum.FAALIYET, etiket: 'Sorumlu Bölüm Onayı', secim: 'izlemeSorumlusu' })
    expect(uygunGecisler(ctx(YABANCI), st({ izlemeSorumlusuUserId: null })).find((x) => x.hedef === FifDurum.FAALIYET)).toBe(undefined)
  })
  it('"Faaliyetleri Başlat" adımı YOK — FAALIYET\'te bu geçiş yeniden görünmez', () => {
    const etiketler = uygunGecisler(ctx(SORUMLU_ONAY), baseState({ durum: FifDurum.FAALIYET })).map((x) => x.etiket)
    expect(etiketler).not.toContain('Faaliyetleri Başlat')
    expect(etiketler).not.toContain('Sorumlu Bölüm Onayı')
  })
  it('müdür reddi/iadesi YOK: SORUMLU_ATAMA_BEKLIYOR → TASLAK / KSS_KAYIT_BEKLIYOR geçersiz', () => {
    for (const hedef of [FifDurum.TASLAK, FifDurum.KSS_KAYIT_BEKLIYOR]) {
      const r = gecisYapabilirMi(ctx(SORUMLU_ONAY), st(), hedef)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.tur).toBe('gecersiz')
    }
  })
  it('İptal yalnız manage (TASLAK dışı kural)', () => {
    expect(gecisYapabilirMi(ctx(SORUMLU_ONAY), st(), FifDurum.IPTAL).ok).toBe(false)
    expect(gecisYapabilirMi(ctx(YABANCI, true), st(), FifDurum.IPTAL).ok).toBe(true)
  })
  it('Kapatmaya Gönder yetkisi aynen: izleme sorumlusu / sorumlu bölüm müdürü', () => {
    const kapali = { hedefTarih: new Date(), sonuc: 'K', gerceklesenTarih: new Date(), parafUserId: 'uKss' }
    const f = baseState({ durum: FifDurum.FAALIYET, faaliyetler: [kapali] })
    expect(gecisYapabilirMi(ctx(IZLEME), f, FifDurum.KAPATMA_BEKLIYOR).ok).toBe(true)
    expect(gecisYapabilirMi(ctx(MUDUR), f, FifDurum.KAPATMA_BEKLIYOR).ok).toBe(true)
  })
})

describe('fif-durum — Paket 4: kokNedenDoluMu (özet / Ek-1 / 5 Neden)', () => {
  const bos = { kokNedenAnalizi: null, kokNedenler: [], besNedenler: [] }
  it('üçü de boşsa false; boşluk-only özet ve boş Ek-1 notu BOŞ sayılır', () => {
    expect(kokNedenDoluMu(bos)).toBe(false)
    expect(kokNedenDoluMu({ ...bos, kokNedenAnalizi: '   ', kokNedenler: [{ aciklama: ' ' }] })).toBe(false)
  })
  it('herhangi biri doluysa true', () => {
    expect(kokNedenDoluMu({ ...bos, kokNedenAnalizi: 'Kalibrasyon eksik' })).toBe(true)
    expect(kokNedenDoluMu({ ...bos, kokNedenler: [{ aciklama: 'Makine' }] })).toBe(true)
    expect(kokNedenDoluMu({ ...bos, besNedenler: [{ id: 'b1' }] })).toBe(true)
  })
})

describe('fif-durum — Paket 4: faaliyetPlanlamaYetkisi (satır ekleme, hedef tarih, uygulama sorumlusu)', () => {
  const s = (durum: FifDurum) => ({ durum, sorumluOnaylayanUserId: SORUMLU_ONAY, izlemeSorumlusuUserId: IZLEME })
  it('FAALIYET\'te sorumlu bölüm müdürü / izleme sorumlusu / manage izinli', () => {
    expect(faaliyetPlanlamaYetkisi({ userId: SORUMLU_ONAY, isManage: false }, s(FifDurum.FAALIYET))).toBe(null)
    expect(faaliyetPlanlamaYetkisi({ userId: IZLEME, isManage: false }, s(FifDurum.FAALIYET))).toBe(null)
    expect(faaliyetPlanlamaYetkisi({ userId: YABANCI, isManage: true }, s(FifDurum.FAALIYET))).toBe(null)
  })
  it('hazırlayan / satır sorumlusu / KSS → 403', () => {
    for (const u of [HAZIRLAYAN, 'uSatir', KSS]) {
      expect(faaliyetPlanlamaYetkisi({ userId: u, isManage: false }, s(FifDurum.FAALIYET))?.status).toBe(403)
    }
  })
  it('müdür snapshot\'ı ve izleme yoksa yalnız manage', () => {
    const bos = { durum: FifDurum.FAALIYET, sorumluOnaylayanUserId: null, izlemeSorumlusuUserId: null }
    expect(faaliyetPlanlamaYetkisi({ userId: null, isManage: false }, bos)?.status).toBe(403)
    expect(faaliyetPlanlamaYetkisi({ userId: 'x', isManage: true }, bos)).toBe(null)
  })
  it('FAALIYET dışında (SORUMLU_ATAMA_BEKLIYOR dahil) herkese 400 — manage dahil', () => {
    for (const d of [FifDurum.TASLAK, FifDurum.KSS_KAYIT_BEKLIYOR, FifDurum.SORUMLU_ATAMA_BEKLIYOR, FifDurum.KAPATMA_BEKLIYOR, FifDurum.KSS_KAPANIS_BEKLIYOR, FifDurum.ETKINLIK]) {
      expect(faaliyetPlanlamaYetkisi({ userId: SORUMLU_ONAY, isManage: false }, s(d))?.status).toBe(400)
      expect(faaliyetPlanlamaYetkisi({ userId: YABANCI, isManage: true }, s(d))?.status).toBe(400)
    }
  })
})

describe('fif-durum — geçersiz geçiş + yardımcılar', () => {
  it('TASLAK → KAPANDI geçersiz', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), baseState(), FifDurum.KAPANDI).ok).toBe(false)
  })
  it('uygunGecisler TASLAK/hazırlayan: KSS_KAYIT_BEKLIYOR + IPTAL (ONAY_BEKLIYOR yok)', () => {
    const g = uygunGecisler(ctx(HAZIRLAYAN), baseState()).map((x) => x.hedef)
    expect(g).toContain(FifDurum.KSS_KAYIT_BEKLIYOR)
    expect(g).not.toContain(FifDurum.ONAY_BEKLIYOR)
    expect(g).toContain(FifDurum.IPTAL)
  })
  it('altKayitDuzenlenebilir: KAPANDI kilitli, manage açık', () => {
    expect(altKayitDuzenlenebilir(ctx(YABANCI), FifDurum.KAPANDI)).toBe(false)
    expect(altKayitDuzenlenebilir(ctx(YABANCI, true), FifDurum.KAPANDI)).toBe(true)
    expect(altKayitDuzenlenebilir(ctx(YABANCI), FifDurum.FAALIYET)).toBe(true)
  })
  it('esKurali: ES ama FAALIYET değil → hata; ES + ekTermin boş → hata; ES + neden → ok', () => {
    expect(esKuraliGecerli(FifDurum.KAPATMA_BEKLIYOR, FifSonuc.ES, 'x').ok).toBe(false)
    expect(esKuraliGecerli(FifDurum.FAALIYET, FifSonuc.ES, '').ok).toBe(false)
    expect(esKuraliGecerli(FifDurum.FAALIYET, FifSonuc.ES, 'gecikme').ok).toBe(true)
    expect(esKuraliGecerli(FifDurum.FAALIYET, FifSonuc.K, null).ok).toBe(true)
  })
})

describe('fif-durum — Faz 3: ES geçmiş açıklaması', () => {
  it('eski→yeni tarih + neden birleştirir', () => {
    expect(esGecmisAciklamasi('2026-09-20', '2026-10-05', 'tedarik gecikmesi'))
      .toBe('ES: 2026-09-20 → 2026-10-05, neden: tedarik gecikmesi')
  })
  it('eski tarih null ise — ile gösterir', () => {
    expect(esGecmisAciklamasi(null, '2026-10-05', 'x')).toBe('ES: — → 2026-10-05, neden: x')
  })
})

describe('fif-durum — Faz 3: etkinlik upsert ön koşulu (KAPANDI kapısı)', () => {
  const base = () => ({
    durum: FifDurum.ETKINLIK, createdById: 'h', hazirlayanUserId: 'h', yayinlayanOnaylayanUserId: 'y',
    sorumluOnaylayanUserId: 's', izlemeSorumlusuUserId: 'i',
    sorumluBolumId: 'd', uygunsuzlukTanimi: 'x', tur: 'DUZELTICI', faaliyetler: [],
  }) as unknown as FifGecisState
  const ctx = { userId: 'k', isManage: false, sorumluBolumMudurUserId: null, isKss: true }
  it('yalnız KAPATMA uygun → KAPANDI reddedilir (TEKRAR_ETMEME eksik)', () => {
    const s = { ...base(), etkinlikler: [{ madde: 'KAPATMA', uygun: true }] }
    expect(gecisYapabilirMi(ctx, s, FifDurum.KAPANDI).ok).toBe(false)
  })
  it('ikisi de uygun → KAPANDI olur', () => {
    const s = { ...base(), etkinlikler: [{ madde: 'KAPATMA', uygun: true }, { madde: 'TEKRAR_ETMEME', uygun: true }] }
    expect(gecisYapabilirMi(ctx, s, FifDurum.KAPANDI).ok).toBe(true)
  })
  it('biri uygun değil → KAPANDI reddedilir', () => {
    const s = { ...base(), etkinlikler: [{ madde: 'KAPATMA', uygun: true }, { madde: 'TEKRAR_ETMEME', uygun: false }] }
    expect(gecisYapabilirMi(ctx, s, FifDurum.KAPANDI).ok).toBe(false)
  })
  it('biri uygun null → KAPANDI reddedilir', () => {
    const s = { ...base(), etkinlikler: [{ madde: 'KAPATMA', uygun: true }, { madde: 'TEKRAR_ETMEME', uygun: null }] }
    expect(gecisYapabilirMi(ctx, s, FifDurum.KAPANDI).ok).toBe(false)
  })
})

describe('fif-durum — Faz 3: Ek-1/Ek-2 düzenleme kilidi (altKayitDuzenlenebilir)', () => {
  const c = (m = false) => ({ userId: 'u', isManage: m, sorumluBolumMudurUserId: null })
  it('FAALIYET ve sonrası açık (TASLAK/FAALIYET/ETKINLIK/KAPATMA_BEKLIYOR)', () => {
    for (const dr of [FifDurum.TASLAK, FifDurum.FAALIYET, FifDurum.ETKINLIK, FifDurum.KAPATMA_BEKLIYOR]) {
      expect(altKayitDuzenlenebilir(c(), dr)).toBe(true)
    }
  })
  it('KAPANDI kilitli (manage hariç)', () => {
    expect(altKayitDuzenlenebilir(c(false), FifDurum.KAPANDI)).toBe(false)
    expect(altKayitDuzenlenebilir(c(true), FifDurum.KAPANDI)).toBe(true)
  })
  it('IPTAL kilitli (manage hariç)', () => {
    expect(altKayitDuzenlenebilir(c(false), FifDurum.IPTAL)).toBe(false)
    expect(altKayitDuzenlenebilir(c(true), FifDurum.IPTAL)).toBe(true)
  })
})

describe('fif-durum — iptal/sil 404 fix: IPTAL salt-okunur, hard delete redirect', () => {
  const st = (durum: FifDurum) => ({
    durum, createdById: 'h', hazirlayanUserId: 'h', yayinlayanOnaylayanUserId: 'y',
    sorumluOnaylayanUserId: 's', izlemeSorumlusuUserId: 'i',
    sorumluBolumId: 'd', uygunsuzlukTanimi: 'x', tur: 'DUZELTICI', faaliyetler: [], etkinlikler: [],
  }) as unknown as FifGecisState
  const ctx = { userId: 'h', isManage: true, sorumluBolumMudurUserId: null }

  it('IPTAL durumunda yapılabilecek geçiş YOK (detay salt-okunur açılır)', () => {
    expect(uygunGecisler(ctx, st(FifDurum.IPTAL))).toEqual([])
  })
  it('IPTAL kaydına yeni geçiş de reddedilir (KAPANDI dahil)', () => {
    expect(gecisYapabilirMi(ctx, st(FifDurum.IPTAL), FifDurum.FAALIYET).ok).toBe(false)
    expect(gecisYapabilirMi(ctx, st(FifDurum.IPTAL), FifDurum.IPTAL).ok).toBe(false)
  })
  it('boş TASLAK hard delete → true (handler bu durumda listeye redirect eder)', () => {
    expect(hardDeleteEdilebilir(FifDurum.TASLAK, false)).toBe(true)
  })
})

describe('fif-durum-etiket — Geçmiş olay etiketi', () => {
  it('izleme sorumlusu değişikliği kendi olayıyla; olay boş eski satırlar (ES / durum) aynen', () => {
    expect(fifOlayEtiketi({ olay: 'IZLEME_SORUMLUSU_DEGISTI', aciklama: 'Faaliyet izleme sorumlusu boşaltıldı (önceki: A)' })).toBe('İzleme sorumlusu değişti')
    expect(fifOlayEtiketi({ olay: null, aciklama: 'ES: 2026-09-01 → 2026-10-01, neden: x' })).toBe('Ek süre (eski)')
    expect(fifOlayEtiketi({ olay: null, aciklama: null })).toBe('Durum değişti')
    expect(fifOlayEtiketi({ olay: 'FAALIYET_YAPILAMADI', aciklama: null })).toBe('Faaliyet yapılamadı (YT)')
  })
})
