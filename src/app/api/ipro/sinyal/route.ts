import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/ipro/sinyal — PLC poller'ın /health + /pins verisini SUNUCU TARAFINDAN çeker.
 *
 * NEDEN PROXY: poller yalnız 127.0.0.1:3020'de dinliyor ve auth'u YOK. Tarayıcının
 * oraya doğrudan gitmesi hem imkânsız (dışarı açık değil) hem de istenmez. Bu route
 * kimlik/yetki kontrolünü yapar, poller'ı localhost'ta kapalı tutar.
 *
 * GUARD ZORUNLU — middleware `/api/*` rotalarını KAPSAMIYOR (src/middleware.ts matcher'ı
 * yalnız sayfa yollarını listeler). Yetki kontrolü burada, elle yapılır.
 *
 * SALT OKUMA: poller'a yazma yok, DB'ye yazma yok, PLC'ye dokunulmaz.
 *
 * Poller kapalıysa ÇÖKMEZ: 200 + { pollerErisilebilir: false } döner; ekran net bir
 * "poller erişilemiyor" durumu gösterir (boş tablo değil).
 */

const POLLER_BASE = `http://127.0.0.1:${process.env.IPRO_POLLER_PORT ?? 3020}`
const TIMEOUT_MS = 2_000

async function pollerGet<T>(yol: string): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${POLLER_BASE}${yol}`, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`poller ${yol} HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export async function GET() {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error

  const [health, pins] = await Promise.allSettled([
    pollerGet<unknown>('/health'),
    pollerGet<{ pins?: unknown[]; pinSayisi?: number; sonOkuma?: string | null }>('/pins'),
  ])

  // İkisi de başarısızsa poller erişilemez sayılır (biri gelirse kısmi gösterilir).
  if (health.status === 'rejected' && pins.status === 'rejected') {
    const sebep = health.reason instanceof Error ? health.reason.message : String(health.reason)
    return NextResponse.json({
      ok: true,
      pollerErisilebilir: false,
      hata: sebep,
      olusturuldu: new Date().toISOString(),
      health: null,
      pins: [],
    })
  }

  return NextResponse.json({
    ok: true,
    pollerErisilebilir: true,
    olusturuldu: new Date().toISOString(),
    health: health.status === 'fulfilled' ? health.value : null,
    pins: pins.status === 'fulfilled' ? (pins.value?.pins ?? []) : [],
  })
}
