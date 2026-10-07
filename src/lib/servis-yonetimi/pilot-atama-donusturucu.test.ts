import { describe, it, expect } from 'vitest'
import { donustur, durakCoz, normalizeTR, PILOT_SABLON_BASLIKLARI, SERVIS_ADI_TO_GUZERGAH } from './pilot-atama-donusturucu'
import { TUM_GUZERGAHLAR } from './servis-tanim-verisi'
import { SABLON_BASLIKLARI } from './excel-atama'

const s = (sicil: string, servis: string, durak: string, satirNo = 2) => ({ satirNo, sicil, servis, durak })

describe('pilot atama dönüştürücü', () => {
  it('sözlüğün tüm hedefleri tanımlı güzergâh kodudur', () => {
    const kodlar = new Set(TUM_GUZERGAHLAR.map((g) => g.kod))
    for (const kod of Object.values(SERVIS_ADI_TO_GUZERGAH)) expect(kodlar.has(kod)).toBe(true)
  })

  it('servis adı Türkçe normalize + takma ad: "BEYLİKBAĞI GÜZELTEPE/ÇAYIROVA" → BEYLIKBAGI_GUZELTEPE', () => {
    const r = donustur([s('1', 'BEYLİKBAĞI GÜZELTEPE/ÇAYIROVA', 'Trafo')])
    expect(r.eslesmeyenler).toEqual([])
    expect(r.atamalar[0].guzergahKod).toBe('BEYLIKBAGI_GUZELTEPE')
  })

  it('I/İ/ı: "uskudar" ve "ÜSKÜDAR" aynı güzergâh; "kaynarca-kartal" ve "KAYNARCA PENDİK" aynı', () => {
    expect(normalizeTR('Üsküdar')).toBe(normalizeTR('ÜSKÜDAR'))
    const r = donustur([s('1', 'üsküdar', 'Mehmet Akif'), s('2', 'KAYNARCA PENDİK', 'x')])
    expect(r.atamalar.length + r.eslesmeyenler.length).toBe(2)
    expect(r.atamalar.find((a) => a.sicil === '2')?.guzergahKod ?? r.eslesmeyenler.find((e) => e.sicil === '2')).toBeTruthy()
  })

  it('durak: eşleme tablosu hamMetin → hedef → kod (güzergâh içinde)', () => {
    expect(durakCoz('ARAPCESME', 'H. YOLU')).toEqual({ ok: true, kod: 'ARAPCESME-03' })
    expect(durakCoz('ARAPCESME', 'cezaevi kapısı')).toEqual({ ok: true, kod: 'ARAPCESME-01' })
  })

  it('durak: tanımdaki ad birebir (normalize) bulunur; yazım hatası TAHMİN EDİLMEZ', () => {
    expect(durakCoz('ARAPCESME', 'KASKAR FIRIN')).toEqual({ ok: true, kod: 'ARAPCESME-02' })
    const r = durakCoz('ARAPCESME', 'Kaskar Firin Yani')
    expect(r.ok).toBe(false)
  })

  it('aynı adlı iki durak (Üsküdar/Mehmet Akif) → belirsiz, eşleşmeyen', () => {
    const r = durakCoz('DARICA', 'Mehmet Akif')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.neden).toContain('birden çok')
  })

  it('Sarı Cami / SARI CAMİİ ayrı duraklardır; her biri kendi koduna gider', () => {
    expect(durakCoz('BEYLIKBAGI_ULASTEPE', 'Sarı Cami')).toEqual({ ok: true, kod: 'BEYLIKBAGI_ULASTEPE-01' })
    expect(durakCoz('BEYLIKBAGI_ULASTEPE', 'SARI CAMİİ')).toEqual({ ok: true, kod: 'BEYLIKBAGI_ULASTEPE-17' })
  })

  it('durak başka güzergâhta olsa da bu güzergâhta yoksa eşleşmez', () => {
    expect(durakCoz('ARAPCESME', 'Trafo').ok).toBe(false)
  })

  it('KENDİ GELİYOR / KENDİ ARACI / İZMİT / ŞİRKET ARACI / SERVİS YOK / bos → atama üretilmez, ayrı listede', () => {
    const r = donustur([
      s('1', 'KENDİ GELİYOR', ''), s('2', 'kendi aracı', 'x'), s('3', 'İZMİT', ''), s('4', 'ŞİRKET ARACI', ''),
      s('5', 'SERVİS YOK', ''), s('6', '', ''),
    ])
    expect(r.atamalar).toEqual([])
    expect(r.eslesmeyenler).toEqual([])
    expect(r.atamaUretilmeyenler.map((u) => u.sebep)).toEqual(['KENDI_GELIYOR', 'KENDI_GELIYOR', 'IZMIT_SIRKET_ARACI', 'IZMIT_SIRKET_ARACI', 'SERVIS_YOK', 'BOS'])
  })

  it('eşleşmeyen nedenleri: sözlükte yok, İK kararı, durak boş, servis boş durak dolu, sicil boş, yinelenen sicil', () => {
    const r = donustur([
      s('1', 'BİLİNMEYEN HAT', 'x'), s('2', 'GEBZE', 'x'), s('3', 'DARICA', ''), s('4', '', 'x'),
      s('', 'DARICA', 'İtfaiye'), s('7', 'DARICA', 'İtfaiye'), s('7', 'DARICA', 'İtfaiye', 3),
    ])
    expect(r.atamalar).toEqual([])
    const nedenler = r.eslesmeyenler.map((e) => e.neden)
    expect(nedenler[0]).toBe('Servis adı sözlükte yok')
    expect(nedenler[1]).toBe('Servis adı İK kararı bekliyor')
    expect(nedenler[2]).toBe('Durak boş')
    expect(nedenler[3]).toBe('Servis boş, durak dolu')
    expect(nedenler[4]).toBe('Sicil boş')
    expect(nedenler.slice(5)).toEqual(['Aynı sicil dosyada birden çok satırda', 'Aynı sicil dosyada birden çok satırda'])
  })

  it('her girdi satırı tam bir listeye düşer (kayıp yok)', () => {
    const girdi = [s('1', 'DARICA', 'İtfaiye'), s('2', 'KENDİ GELİYOR', ''), s('3', 'XXX', 'y'), s('4', '', '')]
    const r = donustur(girdi)
    expect(r.atamalar.length + r.eslesmeyenler.length + r.atamaUretilmeyenler.length).toBe(girdi.length)
  })

  it('şablon başlıkları Excel toplu atama şablonuyla aynı', () => {
    expect([...PILOT_SABLON_BASLIKLARI]).toEqual([...SABLON_BASLIKLARI])
  })
})
