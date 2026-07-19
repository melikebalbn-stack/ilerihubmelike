import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { yenileKioskSifre } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST — cihaz şifresini yeniler. Eski şifre ANINDA geçersizleşir, cihaz
 * yeniden giriş yapmak zorunda kalır → UI'da onay dialog'u zorunlu.
 * Yeni şifre yanıtta BİR KEZ döner.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, kiosk: await yenileKioskSifre(id) })
  } catch (e) {
    return iproHata(e, 'Şifre yenilenemedi')
  }
}
