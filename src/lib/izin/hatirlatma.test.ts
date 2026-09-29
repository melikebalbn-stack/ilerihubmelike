// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * İzin Faz 6 — hatırlatma kuralları (saf) + GERÇEK mail şablonunda tür sızıntısı taraması.
 * Akış (tek gönderim, kademe sayacı, erteleme, no-op, dryRun, erken dönüş): talep-akis.test.ts.
 */

const giden = vi.hoisted(() => ({ mailler: [] as { to: unknown; konu: string; text: string; html: string }[] }))

vi.mock('@/lib/email', () => ({
  sendEmail: async (to: unknown, konu: string, text: string, html: string) => {
    giden.mailler.push({ to, konu, text, html })
    return { success: true }
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: async () => [{ email: 'yonetici@ornek.test', name: 'Yönetici' }] },
    systemSetting: { findUnique: async () => ({ value: 'iv1@ornek.test, iv2@ornek.test' }) },
  },
}))

import {
  GONDERIM_BASLANGIC_DK, gonderimPenceresi, hatirlatmaSaati, kademeDususu, talepAnahtari, vadeDolduMu, yerelZaman,
} from './hatirlatma-kurallari'
import * as mail from './mail'

const yerel = (s: string) => new Date(`${s.replace(' ', 'T')}:00+03:00`)

describe('hatırlatma kuralları (saf)', () => {
  it('yerel zaman +03:00: UTC 05:30 = 08:30 yerel', () => {
    expect(yerelZaman(new Date('2026-11-04T05:30:00Z'))).toEqual({ gun: '2026-11-04', dakika: GONDERIM_BASLANGIC_DK, haftaGunu: 3 })
    expect(yerelZaman(new Date('2026-11-04T22:00:00Z')).gun).toBe('2026-11-05') // gece yarısı sonrası ertesi gün
  })

  it('gönderim penceresi: hafta sonu / TATIL / 08:30 öncesi kapalı; YARIM (arefe) açık', () => {
    expect(gonderimPenceresi(yerel('2026-11-04 08:30'), null)).toEqual({ acik: true })
    expect(gonderimPenceresi(yerel('2026-11-04 08:29'), null)).toEqual({ acik: false, sebep: '08:30 öncesi' })
    expect(gonderimPenceresi(yerel('2026-11-04 02:00'), null)).toEqual({ acik: false, sebep: '08:30 öncesi' }) // iş günü gecesi
    expect(gonderimPenceresi(yerel('2026-10-31 10:00'), null)).toEqual({ acik: false, sebep: 'hafta sonu' })
    expect(gonderimPenceresi(yerel('2026-11-01 10:00'), null)).toEqual({ acik: false, sebep: 'hafta sonu' })
    expect(gonderimPenceresi(yerel('2026-10-29 10:00'), 'TATIL')).toEqual({ acik: false, sebep: 'resmi tatil' })
    expect(gonderimPenceresi(yerel('2026-10-28 10:00'), 'YARIM')).toEqual({ acik: true })
    expect(gonderimPenceresi(yerel('2026-10-28 10:00'), 'MESAI')).toEqual({ acik: true })
  })

  it('24 saat sınırı dahil', () => {
    const d = yerel('2026-11-03 10:00')
    expect(vadeDolduMu(d, new Date(d.getTime() + 24 * 3600_000 - 1), 24)).toBe(false)
    expect(vadeDolduMu(d, new Date(d.getTime() + 24 * 3600_000), 24)).toBe(true)
  })

  it('ayar: pozitif tam sayı değilse 24', () => {
    expect(hatirlatmaSaati('48')).toBe(48)
    for (const x of [null, undefined, '', '0', '-3', '1.5', 'abc']) expect(hatirlatmaSaati(x)).toBe(24)
  })

  it('kademe düşüşü: yönetici = oluşturma; İV = yönetici kademesinin son ONAY/ATLANDI izi, yoksa oluşturma', () => {
    const olusturma = yerel('2026-11-02 09:00')
    const onay = yerel('2026-11-03 14:00')
    expect(kademeDususu({ durum: 'BEKLIYOR_YONETICI', createdAt: olusturma, onaylar: [] })).toEqual({ kademe: 'YONETICI', dusus: olusturma })
    expect(kademeDususu({ durum: 'BEKLIYOR_IV', createdAt: olusturma, onaylar: [{ kademe: 'YONETICI', karar: 'ONAY', createdAt: onay }] }))
      .toEqual({ kademe: 'IV', dusus: onay })
    expect(kademeDususu({ durum: 'BEKLIYOR_IV', createdAt: olusturma, onaylar: [{ kademe: 'YONETICI', karar: 'ATLANDI', createdAt: olusturma }] }))
      .toEqual({ kademe: 'IV', dusus: olusturma })
    expect(kademeDususu({ durum: 'BEKLIYOR_IV', createdAt: olusturma, onaylar: [{ kademe: 'SISTEM', karar: 'NOT', createdAt: onay }] }))
      .toEqual({ kademe: 'IV', dusus: olusturma })
    for (const durum of ['ONAYLANDI', 'REDDEDILDI', 'GERI_CEKILDI', 'IPTAL']) expect(kademeDususu({ durum, createdAt: olusturma, onaylar: [] })).toBeNull()
    expect(talepAnahtari('t1', 'IV')).toBe('TALEP:t1:IV')
  })
})

describe('tür sızıntısı — GERÇEK hatırlatma mail şablonu', () => {
  const GIZLI = 'GİZLİ-TÜR-Hastalık-Raporu'
  const talep = { id: 't1', personelAd: 'Ayşe Yılmaz', sicil: 'ILR-00001', turAd: GIZLI, baslangic: '2026-11-09', bitis: '2026-11-10', gunSayisi: 2 }
  beforeEach(() => { giden.mailler = [] })

  it('yönetici hatırlatması: kişi + tarih + süre + Onay Bekleyenler; tür YOK (html, metin, konu)', async () => {
    expect(await mail.yoneticiyeHatirlatma(talep, ['u-m', null, null])).toBe(1)
    expect(giden.mailler).toHaveLength(1)
    const m = giden.mailler[0]
    for (const alan of [m.konu, m.text, m.html]) expect(alan).not.toContain(GIZLI)
    expect(m.html).toContain('Ayşe Yılmaz')
    expect(m.html).toContain('09.11.2026 – 10.11.2026')
    expect(m.html).toContain('2 gün')
    expect(m.html).toContain('Onay Bekleyenler')
    expect(m.html).toContain('/izin/onay')
  })

  it('İV hatırlatması da türsüz; alıcılar izin_iv_bildirim_eposta ayarından', async () => {
    expect(await mail.iveHatirlatma(talep)).toBe(2)
    expect(giden.mailler.map((m) => m.to)).toEqual([[{ email: 'iv1@ornek.test', name: 'iv1@ornek.test' }], [{ email: 'iv2@ornek.test', name: 'iv2@ornek.test' }]])
    for (const m of giden.mailler) for (const alan of [m.konu, m.text, m.html]) expect(alan).not.toContain(GIZLI)
  })

  it('saatlik talepte süre saat olarak (gün değil)', async () => {
    await mail.yoneticiyeHatirlatma({ ...talep, bitis: talep.baslangic, gunSayisi: 0, dakika: 150 }, ['u-m'])
    expect(giden.mailler[0].html).toContain('2,5 sa')
    expect(giden.mailler[0].html).not.toContain('0 gün')
  })

  it('erken dönüş özeti: kişi ve tür YOK, yalnız adet', async () => {
    await mail.erkenDonusHatirlatma(3)
    for (const m of giden.mailler) {
      expect(m.html).toContain('/izin/onay?sekme=erken')
      expect(m.html).not.toContain('Ayşe')
    }
  })

  it('kod taraması: hatırlatma mailleri tamSatirlar/turAd kullanmaz; servis türü okumaz', () => {
    const kaynak = fs.readFileSync(path.join(__dirname, 'mail.ts'), 'utf8')
    const faz6 = kaynak.slice(kaynak.indexOf('Faz 6 — onay hatırlatmaları'))
    expect(faz6.length).toBeGreaterThan(100)
    expect(faz6).not.toMatch(/tamSatirlar|turAd/)
    const servis = fs.readFileSync(path.join(__dirname, 'hatirlatma.ts'), 'utf8')
    expect(servis).not.toMatch(/\btur\s*:|turAd/)
  })
})
