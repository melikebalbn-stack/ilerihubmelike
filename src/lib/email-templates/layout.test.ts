import { describe, it, expect } from 'vitest'
import {
  renderEmail,
  renderEmailHtml,
  renderEmailText,
  HUB_MAIL_STAMP,
  p,
} from './layout'

const ORNEK = {
  module: 'Kalite' as const,
  title: 'RMA/SMA sorumluluğu atandı',
  subtitle: 'RMA No 42',
  bodyHtml: p('Merhaba Ahmet,') + p('Bir iade kaydına <strong>sorumlu</strong> olarak atandınız.'),
  infoRows: [
    { label: 'Kayıt', value: 'RMA No 42' },
    { label: 'Müşteri', value: 'Acme A.Ş.' },
  ],
  cta: { label: 'Kaydı Aç', url: 'https://hub.ilerigroup.com/kalite/rma/42' },
  footnote: 'Ayrıntı için giriş yapın.',
}

describe('renderEmail', () => {
  it('{ html, text } döndürür', () => {
    const sonuc = renderEmail(ORNEK)
    expect(sonuc).toHaveProperty('html')
    expect(sonuc).toHaveProperty('text')
    expect(typeof sonuc.html).toBe('string')
    expect(typeof sonuc.text).toBe('string')
  })

  it('HTML ortak şablon damgasını içerir', () => {
    const { html } = renderEmail(ORNEK)
    expect(html).toContain(HUB_MAIL_STAMP)
    expect(html).toContain('<!-- hub-mail-v1 -->')
  })

  it('bilgi tablosunu (etiket + değer) basar', () => {
    const { html } = renderEmail(ORNEK)
    expect(html).toContain('Kayıt')
    expect(html).toContain('RMA No 42')
    expect(html).toContain('Müşteri')
    expect(html).toContain('Acme A.Ş.')
  })

  it('tek butonu + fallback bağlantısını basar', () => {
    const { html } = renderEmail(ORNEK)
    expect(html).toContain('Kaydı Aç')
    expect(html).toContain('https://hub.ilerigroup.com/kalite/rma/42')
    // fallback düz bağlantı (şema atılmış görünen url)
    expect(html).toContain('hub.ilerigroup.com/kalite/rma/42')
    expect(html).toContain('Buton çalışmıyorsa')
  })

  it('modül etiketini üst şeride yazar', () => {
    const { html } = renderEmail(ORNEK)
    expect(html).toContain('Kalite')
  })
})

describe('renderEmailText', () => {
  it('başlık, gövde, tablo satırı (Etiket: Değer), buton URL ve dipnot içerir', () => {
    const text = renderEmailText(ORNEK)
    expect(text).toContain('RMA/SMA sorumluluğu atandı')
    expect(text).toContain('Merhaba Ahmet,')
    expect(text).toContain('Kayıt: RMA No 42')
    expect(text).toContain('Müşteri: Acme A.Ş.')
    expect(text).toContain('Kaydı Aç: https://hub.ilerigroup.com/kalite/rma/42')
    expect(text).toContain('Ayrıntı için giriş yapın.')
    // düz metinde HTML etiketi kalmamalı
    expect(text).not.toContain('<strong>')
    expect(text).not.toContain('<p')
  })

  it('renderEmail.text ile aynı çıktı', () => {
    expect(renderEmail(ORNEK).text).toBe(renderEmailText(ORNEK))
  })
})

describe('renderEmailHtml (eski imza)', () => {
  it('string döndürür ve damgayı içerir', () => {
    const html = renderEmailHtml(ORNEK)
    expect(typeof html).toBe('string')
    expect(html).toContain(HUB_MAIL_STAMP)
  })

  it('renderEmail.html ile birebir aynı', () => {
    expect(renderEmailHtml(ORNEK)).toBe(renderEmail(ORNEK).html)
  })
})
