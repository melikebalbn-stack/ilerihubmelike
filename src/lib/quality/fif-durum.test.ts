import { describe, it, expect } from 'vitest'
import { FifDurum, FifSonuc } from '@/generated/prisma'
import { gecisYapabilirMi, uygunGecisler, altKayitDuzenlenebilir, esKuraliGecerli, esGecmisAciklamasi, hardDeleteEdilebilir, type FifGecisState, type FifGecisCtx } from './fif-durum'

const HAZIRLAYAN = 'uHazir'
const YAYINLAYAN = 'uYayin'
const SORUMLU_ONAY = 'uSorumluOnay'
const IZLEME = 'uIzleme'
const TAKIP = 'uTakip'
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
    takipSorumlusuUserId: TAKIP,
    sorumluBolumId: 'dept1',
    kssUserId: KSS,
    uygunsuzlukTanimi: 'Tespit metni',
    tur: 'DUZELTICI',
    faaliyetler: [],
    etkinlikler: [],
    ...over,
  }
}
const ctx = (userId: string | null, isManage = false, mudur: string | null = MUDUR): FifGecisCtx => ({ userId, isManage, sorumluBolumMudurUserId: mudur })
/** `fif.kss` izinli bağlam (KSS adımları için). */
const kssCtx = (userId: string | null = KSS): FifGecisCtx => ({ userId, isManage: false, sorumluBolumMudurUserId: MUDUR, isKss: true })

describe('fif-durum — TASLAK → ONAY_BEKLIYOR', () => {
  it('hazırlayan gönderebilir', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), baseState(), FifDurum.ONAY_BEKLIYOR).ok).toBe(true)
  })
  it('yabancı gönderemez', () => {
    expect(gecisYapabilirMi(ctx(YABANCI), baseState(), FifDurum.ONAY_BEKLIYOR).ok).toBe(false)
  })
  it('zorunlu alan eksikse (tespit boş) reddeder', () => {
    const r = gecisYapabilirMi(ctx(HAZIRLAYAN), baseState({ uygunsuzlukTanimi: '' }), FifDurum.ONAY_BEKLIYOR)
    expect(r.ok).toBe(false)
  })
  it('manage da gönderebilir', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), baseState(), FifDurum.ONAY_BEKLIYOR).ok).toBe(true)
  })
})

describe('fif-durum — ONAY_BEKLIYOR → KSS_KAYIT_BEKLIYOR / TASLAK(red)', () => {
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

describe('fif-durum — FAALIYET → KAPATMA_BEKLIYOR', () => {
  const dolu = () => baseState({ durum: FifDurum.FAALIYET, faaliyetler: [{ hedefTarih: new Date() }] })
  it('izleme sorumlusu gönderir (faaliyet + hedefTarih tam)', () => {
    expect(gecisYapabilirMi(ctx(IZLEME), dolu(), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(true)
  })
  it('sorumlu bölüm müdürü de gönderir', () => {
    expect(gecisYapabilirMi(ctx(MUDUR), dolu(), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(true)
  })
  it('faaliyet yoksa ön koşul patlar', () => {
    const r = gecisYapabilirMi(ctx(IZLEME), baseState({ durum: FifDurum.FAALIYET }), FifDurum.KAPATMA_BEKLIYOR)
    expect(r.ok).toBe(false)
  })
  it('hedefTarih eksikse ön koşul patlar', () => {
    const r = gecisYapabilirMi(ctx(IZLEME), baseState({ durum: FifDurum.FAALIYET, faaliyetler: [{ hedefTarih: null }] }), FifDurum.KAPATMA_BEKLIYOR)
    expect(r.ok).toBe(false)
  })
  it('yabancı gönderemez', () => {
    expect(gecisYapabilirMi(ctx(YABANCI), dolu(), FifDurum.KAPATMA_BEKLIYOR).ok).toBe(false)
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

  it('KSS izniyle kayda alınır → FAALIYET', () => {
    expect(gecisYapabilirMi(kssCtx(), kayit(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('forma snapshot\'lanmış KSS kullanıcısı da kayda alabilir (izin olmadan)', () => {
    expect(gecisYapabilirMi(ctx(KSS), kayit(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('manage KSS adımını YAPAMAZ (fif.manage KSS yerine geçmez)', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), kayit(), FifDurum.FAALIYET).ok).toBe(false)
  })
  it('sorumlu bölüm atanmadan kayda alınamaz', () => {
    const r = gecisYapabilirMi(kssCtx(), kayit({ sorumluBolumId: null }), FifDurum.FAALIYET)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.sebep).toContain('Sorumlu bölüm')
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

describe('fif-durum — ETKINLIK → KAPANDI / FAALIYET', () => {
  const uygunEtk = [{ madde: 'KAPATMA', uygun: true }, { madde: 'TEKRAR_ETMEME', uygun: true }]
  it('takip sorumlusu iki etkinlik uygun ise kapatır', () => {
    const r = gecisYapabilirMi(ctx(TAKIP), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: uygunEtk }), FifDurum.KAPANDI)
    expect(r.ok).toBe(true)
  })
  it('etkinlik uygun değilse KAPANDI reddedilir', () => {
    const r = gecisYapabilirMi(ctx(TAKIP), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: [{ madde: 'KAPATMA', uygun: false }, { madde: 'TEKRAR_ETMEME', uygun: true }] }), FifDurum.KAPANDI)
    expect(r.ok).toBe(false)
  })
  it('etkinlik satırı eksikse KAPANDI reddedilir', () => {
    const r = gecisYapabilirMi(ctx(TAKIP), baseState({ durum: FifDurum.ETKINLIK, etkinlikler: [{ madde: 'KAPATMA', uygun: true }] }), FifDurum.KAPANDI)
    expect(r.ok).toBe(false)
  })
  it('uygun değil → FAALIYET (yeniden aç) takip sorumlusuna açık', () => {
    expect(gecisYapabilirMi(ctx(TAKIP), baseState({ durum: FifDurum.ETKINLIK }), FifDurum.FAALIYET).ok).toBe(true)
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

describe('fif-durum — geçersiz geçiş + yardımcılar', () => {
  it('TASLAK → KAPANDI geçersiz', () => {
    expect(gecisYapabilirMi(ctx(YABANCI, true), baseState(), FifDurum.KAPANDI).ok).toBe(false)
  })
  it('uygunGecisler TASLAK/hazırlayan: ONAY_BEKLIYOR + IPTAL', () => {
    const g = uygunGecisler(ctx(HAZIRLAYAN), baseState()).map((x) => x.hedef)
    expect(g).toContain(FifDurum.ONAY_BEKLIYOR)
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
    sorumluOnaylayanUserId: 's', izlemeSorumlusuUserId: 'i', takipSorumlusuUserId: 't',
    sorumluBolumId: 'd', uygunsuzlukTanimi: 'x', tur: 'DUZELTICI', faaliyetler: [],
  }) as unknown as FifGecisState
  const ctx = { userId: 't', isManage: false, sorumluBolumMudurUserId: null }
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
    sorumluOnaylayanUserId: 's', izlemeSorumlusuUserId: 'i', takipSorumlusuUserId: 't',
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
