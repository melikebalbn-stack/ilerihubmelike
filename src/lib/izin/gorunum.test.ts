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

  // İV DIŞI rotaların (çalışan / yönetici — requireUser + izinErisim) import edebileceği izin modülleri. Bu
  // servislerin yönetici/ekip çıktısı gorunum.ts'den geçer (aşağıdaki servis taraması + talep-akis.test.ts
  // çalışma zamanı sızıntı testleri). Yeni bir modül eklemek = bu listeye bilinçli ekleme + sızıntı testi.
  const GUVENLI = ['gorunum', 'talep-servis', 'onay-servis', 'takvim-servis', 'erisim', 'talep-ortak', 'yonetim']

  it('her rota ya yalnız İV izniyle korunur ya da yalnız güvenli servisleri kullanır ve tür SEÇMEZ', () => {
    expect(rotalar.length).toBeGreaterThanOrEqual(18) // Faz 2 (7) + Faz 3 (10) + Faz 5 (takvim) — kapsam boşa geçmesin
    const ihlal: string[] = []
    let ivDisi = 0
    for (const f of rotalar) {
      const s = fs.readFileSync(f, 'utf8')
      const ad = path.relative(KOK, f)
      const guardlar = [...s.matchAll(/requirePermission\([^)]*\)/g)].map((m) => m[0])
      const yalnizIv = guardlar.length > 0 && guardlar.every((g) => IV_GUARD.test(g))
      if (yalnizIv) continue
      ivDisi++
      for (const m of s.matchAll(/from '@\/lib\/izin\/([\w-]+)'/g)) if (!GUVENLI.includes(m[1])) ihlal.push(`${ad}: İV dışı rota güvenli olmayan modülü kullanıyor (${m[1]})`)
      if (/prisma\./.test(s)) ihlal.push(`${ad}: İV dışı rota doğrudan prisma sorgusu yapıyor (servis üzerinden olmalı)`)
      if (/\btur(Id|Ad)?\s*:/.test(s) || /include:\s*{[^}]*\btur\b/.test(s)) ihlal.push(`${ad}: İV dışı rota tür seçiyor`)
    }
    expect(ivDisi).toBeGreaterThanOrEqual(10) // talebim, takvim, önizleme, talepler, geri-cek, adına, onay, onay/:id, menu-bayrak, izin/takvim
    expect(ihlal).toEqual([])
  })

  it('güvenli servisler yönetici/ekip çıktısını gorunum üzerinden üretir', () => {
    const oku = (m: string) => fs.readFileSync(path.join(KOK, 'src/lib/izin', `${m}.ts`), 'utf8')
    const onay = oku('onay-servis')
    // Onay listesi/detayındaki her kalem onayKalemi'nden geçer; ekip tablosu ekipIzinGunu'ndan
    expect(onay).toMatch(/onayKalemi\(await kalemGirdisi\(t\), false\)/) // yönetici kademesi = kapalı şekil
    expect(onay).toMatch(/ekipIzinGunu\(/)
    expect(onay).not.toMatch(/turAd:\s*t\.tur\.ad[^\n]*\n[^\n]*return/) // tür yalnız kalemGirdisi → onayKalemi
    const talep = oku('talep-servis')
    expect(talep).toMatch(/ekipIzinGunu\(/) // takvim noktası
    expect(talep).toMatch(/listeGorur = hedef === ctx\.personnelId \|\| ctx\.ivMi/) // adına açan yönetici liste görmez
    const takvim = oku('takvim-servis')
    expect(takvim).toMatch(/ekipIzinGunu\(/) // Ekip Takvimi hücreleri
    expect(takvim).not.toMatch(/tur:\s*\{|turId:\s*true|aciklama:\s*true/) // talep sorgularında tür/açıklama seçilmez
  })

  it('İV guard deseni yalnız izin.admin / izin.bakiye.admin kabul eder', () => {
    expect(IV_GUARD.test("requirePermission(['izin.admin', 'izin.bakiye.admin'])")).toBe(true)
    expect(IV_GUARD.test("requirePermission('izin.bakiye.admin')")).toBe(true)
    expect(IV_GUARD.test("requirePermission(['izin.admin', 'pdks.view'])")).toBe(false)
    expect(IV_GUARD.test("requirePermission('izin.approve')")).toBe(false)
  })
})
