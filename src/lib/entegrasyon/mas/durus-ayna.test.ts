import { describe, it, expect } from 'vitest'
import { durusAynaPlani, type MasDurusGirdi, type IproDurusGirdi } from './durus-ayna'

const t = (hhmm: string) => new Date(`2026-09-30T${hhmm}:00.000Z`)
const tezgahByKod = new Map([['PE01', 'tz-pe01']])
const sebepByKod = new Map([
  ['UD', 'sb-ud'],
  ['44', 'sb-kalip'],
  ['06', 'sb-cay'],
])
const mas = (id: number, sebepKod: string, bas: string, bit: string | null): MasDurusGirdi => ({
  id, tezgahKod: 'PE01', baslangic: t(bas), bitis: bit ? t(bit) : null, sebepKod, sebepAd: sebepKod,
})
const ipro = (id: string, masId: number | null, bas: string, bit: string | null, sebep = 'sb-ud'): IproDurusGirdi => ({
  id, masId, tezgahId: 'tz-pe01', baslangic: t(bas), bitis: bit ? t(bit) : null, durusSebebiId: sebep,
})

describe('durusAynaPlani', () => {
  it('UD → Kalıp → UD dizisi: üç ayrı kayıt, gerçek bitişlerle', () => {
    const plan = durusAynaPlani({
      mas: [mas(3, 'UD', '08:39', '08:40'), mas(1, 'UD', '07:21', '08:01'), mas(2, '44', '08:01', '08:27')],
      ipro: [],
      tezgahByKod, sebepByKod,
    })
    expect(plan.olustur.map((o) => [o.masId, o.durusSebebiId, o.baslangic, o.bitis])).toEqual([
      [1, 'sb-ud', t('07:21'), t('08:01')],
      [2, 'sb-kalip', t('08:01'), t('08:27')],
      [3, 'sb-ud', t('08:39'), t('08:40')],
    ])
    expect(plan.guncelle).toEqual([])
  })

  it('açık IPRO kaydı MAS kapandığında MAS bitişiyle kapanır (simdi değil)', () => {
    const plan = durusAynaPlani({
      mas: [mas(1, 'UD', '07:21', '08:01')],
      ipro: [ipro('a', 1, '07:21', null)],
      tezgahByKod, sebepByKod,
    })
    expect(plan.guncelle).toEqual([{ id: 'a', masId: 1, data: { bitis: t('08:01') } }])
    expect(plan.olustur).toEqual([])
  })

  it('idempotent: değişiklik yoksa işlem yok', () => {
    const plan = durusAynaPlani({
      mas: [mas(1, 'UD', '07:21', '08:01')],
      ipro: [ipro('a', 1, '07:21', '08:01')],
      tezgahByKod, sebepByKod,
    })
    expect(plan.guncelle).toEqual([])
    expect(plan.olustur).toEqual([])
  })

  it('aynı MAS satırında sebep değişirse güncellenir', () => {
    const plan = durusAynaPlani({
      mas: [mas(1, '44', '07:21', null)],
      ipro: [ipro('a', 1, '07:21', null, 'sb-ud')],
      tezgahByKod, sebepByKod,
    })
    expect(plan.guncelle).toEqual([{ id: 'a', masId: 1, data: { durusSebebiId: 'sb-kalip', yorum: null } }])
  })

  it('sıfır süreli kapalı duruş yazılmaz', () => {
    const plan = durusAynaPlani({ mas: [mas(9, '06', '07:00', '07:00')], ipro: [], tezgahByKod, sebepByKod })
    expect(plan.olustur).toEqual([])
    expect(plan.atlanan).toEqual([{ sebep: 'sifir_sure', masId: 9, detay: 'PE01 06 - 06' }])
  })

  it('masId olmayan eski kayıt tezgah+başlangıç (±1 dk) ile bağlanır ve bitişi düzeltilir', () => {
    const eski: IproDurusGirdi = { ...ipro('eski', null, '07:21', '08:30'), baslangic: new Date(t('07:21').getTime() + 30_000) }
    const plan = durusAynaPlani({ mas: [mas(1, 'UD', '07:21', '08:01')], ipro: [eski], tezgahByKod, sebepByKod })
    expect(plan.olustur).toEqual([])
    expect(plan.guncelle).toEqual([{ id: 'eski', masId: null, data: { masId: 1, baslangic: t('07:21'), bitis: t('08:01') } }])
  })

  it('eşleşmeyen açık eski kayıt ayrıca raporlanır', () => {
    const plan = durusAynaPlani({ mas: [], ipro: [ipro('eski', null, '05:00', null)], tezgahByKod, sebepByKod })
    expect(plan.eskiAcikEslesmeyen).toEqual([{ id: 'eski', tezgahId: 'tz-pe01' }])
  })

  it("MAS'ta silinmiş açık kayıt sıfır süreye çekilir", () => {
    const plan = durusAynaPlani({ mas: [], masBulunamayan: [5], ipro: [ipro('a', 5, '06:00', null)], tezgahByKod, sebepByKod })
    expect(plan.masSilinmis).toEqual([{ id: 'a', baslangic: t('06:00') }])
  })

  it('tezgahı olmayan ve başlangıcı olmayan satırlar atlanır; eşleşmeyen sebep raporlanır', () => {
    const plan = durusAynaPlani({
      mas: [
        { ...mas(1, 'UD', '07:00', null), tezgahKod: 'YOK' },
        { ...mas(2, 'UD', '07:00', null), baslangic: null },
        mas(3, 'ZZ', '07:10', null),
      ],
      ipro: [], tezgahByKod, sebepByKod,
    })
    expect(plan.atlanan.map((a) => a.sebep)).toEqual(['baslangic_yok', 'tezgah_yok'])
    expect(plan.olustur[0]).toMatchObject({ masId: 3, durusSebebiId: null, yorum: 'MAS: ZZ - ZZ' })
    expect(plan.eslesmeyenSebepler).toEqual(['ZZ - ZZ'])
  })

  it('kapanışlar oluşturmalardan önce sıralanır', () => {
    const plan = durusAynaPlani({
      mas: [mas(1, 'UD', '07:21', '08:01'), mas(2, '44', '08:01', null)],
      ipro: [ipro('a', 1, '07:21', null)],
      tezgahByKod, sebepByKod,
    })
    expect(plan.guncelle[0].data.bitis).toEqual(t('08:01'))
    expect(plan.olustur[0]).toMatchObject({ masId: 2, bitis: null })
  })
})
