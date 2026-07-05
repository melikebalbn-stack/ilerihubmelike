import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/uretim/terminal/is-emirleri?workCenter=WMM01
 *
 * Terminal iş emri listesi — IFS ShopOrderOperations (SALT OKUMA).
 * Yetki: admin.system.manage (terminal ekranlarıyla aynı geçici guard).
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error

  const workCenter =
    new URL(request.url).searchParams.get('workCenter')?.trim() || undefined

  try {
    const isEmirleri = await getShopOrderOperations({ workCenter })
    return NextResponse.json({ ok: true, isEmirleri })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
