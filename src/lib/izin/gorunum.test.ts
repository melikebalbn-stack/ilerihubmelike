// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ekipIzinGunu, turSiziyorMu } from './gorunum'

/**
 * KURAL (Melih 27.09): Ekip takviminde ve yöneticide İZİN TÜRÜ ASLA GÖRÜNMEZ — API yanıtında da gönderilmez.
 * (1) Ekip görünümünün tek kapısı ekipIzinGunu: tür/açıklama/belge alanı üretmez, etiket her türde "İzinli".
 * (2) Rota taraması: src/app/api/izin altındaki her rota ya yalnız İV izniyle korunur (izin.admin /
 *     izin.bakiye.admin) ya da EKİP rotasıdır ve o zaman ekipIzinGunu'nu kullanmak, tür ilişkisini
 *     (tur / turId) SEÇMEMEK zorundadır. Faz 3/5 rotaları yazıldıkça kapsam otomatik genişler.
 */
describe('ekip görünümü — tür asla yok', () => {
  const girdi = {
    personnelId: 'p1', tarih: new Date('2026-10-26T00:00:00Z'), yarim: null, pay: 1, talepDurumu: 'ONAYLANDI',
    // sızdırılmaya çalışılan alanlar (üst katman yanlışlıkla bütün satırı verse bile)
    tur: { kod: 'RAPOR', ad: 'Rapor', pdksEtiketi: 'Raporlu' }, turId: 't1', aciklama: 'grip', gunSayisi: 3,
  }

  it('rapor dahil her türde yalnız "İzinli"; tür/açıklama/gün sayısı kopyalanmaz', () => {
    const g = ekipIzinGunu(girdi)
    expect(g).toEqual({ personnelId: 'p1', tarih: '2026-10-26', yarim: false, durum: 'IZINLI', etiket: 'İzinli' })
    expect(turSiziyorMu(g)).toBeNull()
    expect(Object.keys(g!).sort()).toEqual(['durum', 'etiket', 'personnelId', 'tarih', 'yarim'])
  })

  it('bekleyen → BEKLIYOR; red/iptal ve tatil günü (pay 0) görünmez; yarım gün işaretlenir', () => {
    expect(ekipIzinGunu({ ...girdi, talepDurumu: 'BEKLIYOR_IV', yarim: 'SABAH' })).toMatchObject({ durum: 'BEKLIYOR', yarim: true })
    expect(ekipIzinGunu({ ...girdi, talepDurumu: 'REDDEDILDI' })).toBeNull()
    expect(ekipIzinGunu({ ...girdi, talepDurumu: 'IPTAL' })).toBeNull()
    expect(ekipIzinGunu({ ...girdi, pay: 0 })).toBeNull()
  })

  it('sızıntı dedektörü tür alanını ve tür adını yakalar (kendi kendini doğrulama)', () => {
    expect(turSiziyorMu({ gunler: [{ tarih: '2026-10-26', tur: 'YILLIK' }] })).toBe('$.gunler[0].tur')
    expect(turSiziyorMu({ satirlar: [{ etiket: 'Raporlu' }] })).toMatch(/Raporlu/)
    expect(turSiziyorMu({ satirlar: [{ etiket: 'Evlilik izni' }] })).toMatch(/Evlilik/)
    expect(turSiziyorMu({ satirlar: [{ etiket: 'İzinli', durum: 'IZINLI' }] })).toBeNull()
  })
})

describe('izin API rota taraması', () => {
  const KOK = path.resolve(__dirname, '../../..')
  const DIZIN = path.join(KOK, 'src/app/api/izin')
  const rotalar = fs.existsSync(DIZIN)
    ? (fs.readdirSync(DIZIN, { recursive: true }) as string[]).filter((f) => /route\.ts$/.test(f)).map((f) => path.join(DIZIN, f))
    : []
  const IV_GUARD = /requirePermission\(\s*(\[\s*)?'izin\.(admin|bakiye\.admin)'(\s*,\s*'izin\.(admin|bakiye\.admin)')?\s*\]?\s*\)/

  it('her rota ya yalnız İV izniyle korunur ya da ekip rotası olarak tür seçmez ve ekipIzinGunu kullanır', () => {
    expect(rotalar.length).toBeGreaterThan(0)
    const ihlal: string[] = []
    for (const f of rotalar) {
      const s = fs.readFileSync(f, 'utf8')
      const ad = path.relative(KOK, f)
      const guardlar = [...s.matchAll(/requirePermission\([^)]*\)/g)].map((m) => m[0])
      const yalnizIv = guardlar.length > 0 && guardlar.every((g) => IV_GUARD.test(g))
      if (yalnizIv) continue
      if (!/from '@\/lib\/izin\/gorunum'/.test(s) || !/ekipIzinGunu\(/.test(s)) ihlal.push(`${ad}: İV dışı rota ekipIzinGunu kullanmıyor`)
      if (/\btur(Id)?\s*:/.test(s) || /include:\s*{[^}]*\btur\b/.test(s)) ihlal.push(`${ad}: İV dışı rota tür seçiyor`)
    }
    expect(ihlal).toEqual([])
  })

  it('İV guard deseni yalnız izin.admin / izin.bakiye.admin kabul eder', () => {
    expect(IV_GUARD.test("requirePermission(['izin.admin', 'izin.bakiye.admin'])")).toBe(true)
    expect(IV_GUARD.test("requirePermission('izin.bakiye.admin')")).toBe(true)
    expect(IV_GUARD.test("requirePermission(['izin.admin', 'pdks.view'])")).toBe(false)
    expect(IV_GUARD.test("requirePermission('izin.approve')")).toBe(false)
  })
})
