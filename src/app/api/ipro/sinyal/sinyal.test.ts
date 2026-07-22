/**
 * Sinyal takip proxy route testleri.
 *
 * SAF: DB'ye, poller'a, PLC'ye DOKUNMAZ — `requirePermission` ve global `fetch` mock'lu.
 * Fixture/temizlik gerektirmez, `__tmp__` yok.
 *
 * Kritik kapsam: GUARD (middleware /api/* rotalarını kapsamıyor → route içi kontrol
 * tek koruma) ve poller kapalıyken ÇÖKMEME.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

/** Test içinden değiştirilebilen yetki kümesi. */
const yetki = vi.hoisted(() => ({ keys: new Set<string>(['ipro.admin']) }))

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: vi.fn(async (key: string | string[]) => {
    const gerekli = Array.isArray(key) ? key : [key]
    if (gerekli.some((k) => yetki.keys.has(k))) {
      return { session: { user: { id: 'test-user' } }, userId: 'test-user', error: null }
    }
    return {
      session: null,
      userId: null,
      error: NextResponse.json({ error: 'Yetersiz yetki', required: gerekli }, { status: 403 }),
    }
  }),
}))

import { GET } from '@/app/api/ipro/sinyal/route'

const HEALTH = {
  sonOkuma: '2026-07-22T20:00:00.000Z',
  pollIntervalMs: 5000,
  bayatlikMs: 20000,
  tezgah: { taze: 11, bayat: 0, toplam: 11 },
  plclar: [
    {
      kod: 'PANO-3',
      ip: '192.168.2.247',
      connected: true,
      lastReadAt: '2026-07-22T20:00:00.000Z',
      backoffMs: 1000,
      lastError: null,
      sonOkumaYasiMs: 1200,
      okumaHatasiToplam: 0,
      sonHataZamani: null,
      yenidenBaglanmaSayisi: 0,
      ardArdaHataSayisi: 0,
      zorlaKopmaSayisi: 0,
    },
  ],
}
const PINS = {
  sonOkuma: '2026-07-22T20:00:00.000Z',
  pinSayisi: 2,
  pins: [
    { kod: 206, plc: 'PANO-3', tezgahKod: 'KH32', curSayac: 2053, lastDelta: 0, durusBit: false, sonOkuma: null, bayat: false },
    { kod: 210, plc: 'PANO-3', tezgahKod: null, curSayac: 0, lastDelta: 0, durusBit: false, sonOkuma: null, bayat: true },
  ],
}

const jsonRes = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response

beforeEach(() => {
  yetki.keys = new Set(['ipro.admin'])
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sinyal proxy — GUARD (middleware /api/* kapsamıyor)', () => {
  it('yetkisiz (hiç izin yok) → 403', async () => {
    yetki.keys = new Set()
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('ipro.view YETMEZ → 403 (bu ekran ipro.admin ister)', async () => {
    yetki.keys = new Set(['ipro.view'])
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('ipro.admin → 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => jsonRes(String(url).includes('/pins') ? PINS : HEALTH)),
    )
    const res = await GET()
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
  })

  it('yetkisizken poller\'a HİÇ istek atılmaz (guard önce çalışır)', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    yetki.keys = new Set()
    await GET()
    expect(f).not.toHaveBeenCalled()
  })
})

describe('sinyal proxy — veri birleştirme', () => {
  it('health + pins birleşip döner, pins dizisi düzleştirilir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => jsonRes(String(url).includes('/pins') ? PINS : HEALTH)),
    )
    const res = await GET()
    const d = await res.json()
    expect(d.pollerErisilebilir).toBe(true)
    expect(d.health.tezgah).toEqual({ taze: 11, bayat: 0, toplam: 11 })
    expect(d.health.bayatlikMs).toBe(20000)
    expect(Array.isArray(d.pins)).toBe(true)
    expect(d.pins).toHaveLength(2)
    // tezgahsız pin de gelir (ekranda gösterilecek)
    expect(d.pins.some((p: { tezgahKod: string | null }) => p.tezgahKod === null)).toBe(true)
  })
})

describe('sinyal proxy — poller kapalı (ÇÖKMEZ)', () => {
  it('poller erişilemez → 200 + pollerErisilebilir:false, pins boş', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:3020') }))
    const res = await GET()
    expect(res.status).toBe(200) // ÇÖKME YOK
    const d = await res.json()
    expect(d.ok).toBe(true)
    expect(d.pollerErisilebilir).toBe(false)
    expect(d.hata).toContain('ECONNREFUSED')
    expect(d.pins).toEqual([])
    expect(d.health).toBeNull()
  })

  it('poller HTTP 500 dönerse de çökmez', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response))
    const res = await GET()
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.pollerErisilebilir).toBe(false)
  })

  it('yalnız /pins düşerse kısmi veri döner (health gelir, pins boş)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/pins')) throw new Error('timeout')
        return jsonRes(HEALTH)
      }),
    )
    const res = await GET()
    const d = await res.json()
    expect(d.pollerErisilebilir).toBe(true) // biri geldiyse tamamen erişilemez sayılmaz
    expect(d.health).not.toBeNull()
    expect(d.pins).toEqual([])
  })
})
