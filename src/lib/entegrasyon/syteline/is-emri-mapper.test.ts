import { describe, it, expect } from 'vitest'
import {
  isEmriMapla,
  type IsEmriBaslikGirdi,
  type IsEmriOperasyonGirdi,
  type IsEmriReferans,
} from './is-emri-mapper'

const REF: IsEmriReferans = {
  contract: 'ILER2',
  kaynakHaritasi: new Map([
    ['PE01', '501'],
    ['LZ01', '151'],
    ['CN03', '303'],
  ]),
}

const baslik: IsEmriBaslikGirdi = {
  job: 'J-1001',
  item: '2023-1',
  qty_released: 168,
  job_date: new Date('2026-09-08T07:10:35Z'),
}
const op = (o: Partial<IsEmriOperasyonGirdi> = {}): IsEmriOperasyonGirdi => ({
  oper_num: 10, wc: '501', RESID: 'PE01', pcs_per_mch_hr: 19.04, qty_received: 0, ...o,
})
const ok = (r: ReturnType<typeof isEmriMapla>) => {
  if ('hata' in r) throw new Error('beklenen başarı, hata döndü: ' + r.hata)
  return r
}
const hata = (r: ReturnType<typeof isEmriMapla>) => {
  if (!('hata' in r)) throw new Error('beklenen hata, başarı döndü')
  return r.hata
}

describe('isEmriMapla — Syteline iş emri → IFS ShopOrd + operasyonlar', () => {
  it('tam geçerli iş emri → başlık + operasyonlar + hash', () => {
    const r = ok(isEmriMapla(baslik, [op()], REF))
    expect(r.baslik.OrderNo).toBe('J-1001')
    expect(r.baslik.ReleaseNo).toBe('*')
    expect(r.baslik.SequenceNo).toBe('*')
    expect(r.baslik.Contract).toBe('ILER2')
    expect(r.baslik.PartNo).toBe('2023-1')
    expect(r.baslik.OrgQtyDue).toBe(168)
    expect(r.baslik.RevisedQtyDue).toBe(168)
    expect(r.baslik.DemandCode).toBe('InventOrder')
    expect(r.baslik.OrderCode).toBe('Manufacturing')
    expect(r.baslik.PartOwnership).toBe('CompanyOwned')
    expect(r.operasyonlar).toHaveLength(1)
    expect(r.operasyonlar[0].OperationNo).toBe(10)
    expect(r.operasyonlar[0].WorkCenterNo).toBe('501')
    expect(r.operasyonlar[0].PreferredResourceId).toBe('PE01')
    expect(r.operasyonlar[0].MachRunFactor).toBe(19.04)
    expect(r.operasyonlar[0].RunTimeCode).toBe('UnitsHour')
    expect(r.operasyonlar[0].OperationQty).toBe(168)
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('tarih tutarlılığı — tüm tarih alanları job_date (START_AFTER_NEW_NEED önlemi)', () => {
    const r = ok(isEmriMapla(baslik, [op()], REF))
    const t = new Date('2026-09-08T07:10:35Z').toISOString()
    expect(r.baslik.RevisedStartDate).toBe(t)
    expect(r.baslik.OrgStartDate).toBe(t)
    expect(r.baslik.EarliestStartDate).toBe(t)
    expect(r.baslik.RevisedDueDate).toBe(t)
    expect(r.baslik.OrgDueDate).toBe(t)
    expect(r.baslik.NeedDate).toBe(t)
  })

  it('birden fazla operasyon → hepsi map edilir', () => {
    const r = ok(isEmriMapla(baslik, [op({ oper_num: 10, RESID: 'PE01' }), op({ oper_num: 20, RESID: 'CN03' })], REF))
    expect(r.operasyonlar).toHaveLength(2)
    expect(r.operasyonlar[1].WorkCenterNo).toBe('303')
  })

  it('TEZGAH eşlemesi — Syteline RESID → IFS ResourceId override', () => {
    const ref: IsEmriReferans = { ...REF, esleme: { tezgah: new Map([['KM01', 'LZ01']]) } }
    const r = ok(isEmriMapla(baslik, [op({ RESID: 'KM01' })], ref))
    expect(r.operasyonlar[0].PreferredResourceId).toBe('LZ01')
    expect(r.operasyonlar[0].WorkCenterNo).toBe('151')
  })

  it('eksik tezgah — RESID haritada yok → hata', () => {
    expect(hata(isEmriMapla(baslik, [op({ RESID: 'YOK99' })], REF))).toMatch(/tezgah IFS'te tanımlı değil: YOK99/)
  })

  it('kaynak yok — RESID boş → hata (wc/oper)', () => {
    expect(hata(isEmriMapla(baslik, [op({ RESID: null, wc: '501', oper_num: 10 })], REF))).toMatch(/kaynak yok: 501\/10/)
  })

  it('çevrim yok — pcs_per_mch_hr <= 0 veya null → hata', () => {
    expect(hata(isEmriMapla(baslik, [op({ pcs_per_mch_hr: 0 })], REF))).toMatch(/çevrim yok/)
    expect(hata(isEmriMapla(baslik, [op({ pcs_per_mch_hr: null })], REF))).toMatch(/çevrim yok/)
  })

  it('miktar <= 0 → hata', () => {
    expect(hata(isEmriMapla({ ...baslik, qty_released: 0 }, [op()], REF))).toMatch(/miktarı geçersiz/)
    expect(hata(isEmriMapla({ ...baslik, qty_released: null }, [op()], REF))).toMatch(/miktarı geçersiz/)
  })

  it('tarih boş → hata', () => {
    expect(hata(isEmriMapla({ ...baslik, job_date: null }, [op()], REF))).toMatch(/tarihi boş/)
  })

  it('operasyon yok → hata', () => {
    expect(hata(isEmriMapla(baslik, [], REF))).toMatch(/operasyon yok/)
  })

  it('KURAL: bir operasyon hatalıysa TÜM iş emri hata (kısmi yazma yok)', () => {
    const r = isEmriMapla(baslik, [op({ oper_num: 10, RESID: 'PE01' }), op({ oper_num: 20, RESID: 'YOK99' })], REF)
    expect('hata' in r).toBe(true)
  })

  it('job / PartNo boş → hata', () => {
    expect(hata(isEmriMapla({ ...baslik, job: '  ' }, [op()], REF))).toMatch(/OrderNo\) boş/)
    expect(hata(isEmriMapla({ ...baslik, item: null }, [op()], REF))).toMatch(/PartNo\) boş/)
  })
})
