import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/is-emirleri/ifs?workCenter=... — IFS açık iş emri operasyonları (SALT OKUMA, Melike #1).
// getShopOrderOperations DEĞİŞTİRİLMEDİ (yalnız import). Guard ipro.view (terminal ekranının geçici
// admin.system.manage guard'ı KOPYALANMADI). IFS erişilemezse 502 — pano/geçmiş sekmesini bloklamaz.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error

  const workCenter = new URL(request.url).searchParams.get('workCenter')?.trim() || undefined
  try {
    const items = await getShopOrderOperations({ workCenter })
    return NextResponse.json({ items })
  } catch {
    // IFS hatası → 502. Stack/secret LOGLANMAZ; yalnız kullanıcı mesajı.
    return NextResponse.json({ error: 'IFS bağlantısı kurulamadı' }, { status: 502 })
  }
}
