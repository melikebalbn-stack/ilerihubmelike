import { describe, it, expect } from 'vitest'
import { FifDurum, FifSonuc } from '@/generated/prisma'
import { gecisYapabilirMi, uygunGecisler, altKayitDuzenlenebilir, esKuraliGecerli, type FifGecisState, type FifGecisCtx } from './fif-durum'

const HAZIRLAYAN = 'uHazir'
const YAYINLAYAN = 'uYayin'
const SORUMLU_ONAY = 'uSorumluOnay'
const IZLEME = 'uIzleme'
const TAKIP = 'uTakip'
const MUDUR = 'uMudur'
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
    uygunsuzlukTanimi: 'Tespit metni',
    tur: 'DUZELTICI',
    faaliyetler: [],
    etkinlikler: [],
    ...over,
  }
}
const ctx = (userId: string | null, isManage = false, mudur: string | null = MUDUR): FifGecisCtx => ({ userId, isManage, sorumluBolumMudurUserId: mudur })

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

describe('fif-durum — ONAY_BEKLIYOR → FAALIYET / TASLAK(red)', () => {
  const st = () => baseState({ durum: FifDurum.ONAY_BEKLIYOR })
  it('yayınlayan onaylayan onaylar', () => {
    expect(gecisYapabilirMi(ctx(YAYINLAYAN), st(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('hazırlayan onaylayamaz', () => {
    expect(gecisYapabilirMi(ctx(HAZIRLAYAN), st(), FifDurum.FAALIYET).ok).toBe(false)
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

describe('fif-durum — KAPATMA_BEKLIYOR → ETKINLIK / FAALIYET(red)', () => {
  const st = () => baseState({ durum: FifDurum.KAPATMA_BEKLIYOR })
  it('sorumlu onaylayan onaylar', () => {
    expect(gecisYapabilirMi(ctx(SORUMLU_ONAY), st(), FifDurum.ETKINLIK).ok).toBe(true)
  })
  it('sorumlu onaylayan reddeder (→FAALIYET)', () => {
    expect(gecisYapabilirMi(ctx(SORUMLU_ONAY), st(), FifDurum.FAALIYET).ok).toBe(true)
  })
  it('izleme sorumlusu bu adımı onaylayamaz', () => {
    expect(gecisYapabilirMi(ctx(IZLEME), st(), FifDurum.ETKINLIK).ok).toBe(false)
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
