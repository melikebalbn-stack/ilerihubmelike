import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listKiosklar, createKiosk } from '@/lib/ipro/yonetim-service'
import { iproHata, zorunluMetin, istekHatasi } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, kiosklar: await listKiosklar() })
  } catch (e) {
    return iproHata(e, 'Kiosk cihazları alınamadı')
  }
}

/**
 * POST — yeni kiosk cihazı. KIOSK rollü User hesabı ÜRETİR (login açan kayıt);
 * UI'da onay dialog'u zorunlu. Üretilen şifre yanıtta BİR KEZ döner, tekrar
 * gösterilemez (DB'de bcrypt hash).
 */
export async function POST(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  try {
    const b = await request.json()
    const kod = zorunluMetin(b?.kod, 'Cihaz kodu')
    const ad = zorunluMetin(b?.ad, 'Cihaz adı')
    const tezgahIds = Array.isArray(b?.tezgahIds) ? b.tezgahIds.map(String) : []
    const sonuc = await createKiosk({ kod, ad, tezgahIds })
    // sifre YALNIZ burada; log'a yazılmaz.
    return NextResponse.json({ ok: true, kiosk: sonuc }, { status: 201 })
  } catch (e) {
    return istekHatasi(e) ?? iproHata(e, 'Kiosk cihazı oluşturulamadı')
  }
}
