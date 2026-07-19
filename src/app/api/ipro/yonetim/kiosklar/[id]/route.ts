import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateKiosk, type KioskGuncelleGirdi } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH — ad / aktif / bağlı tezgahlar. aktif=false ise User hesabı da pasifleşir.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    const data: KioskGuncelleGirdi = {}
    if (b?.ad !== undefined) data.ad = String(b.ad).trim()
    if (b?.aktif !== undefined) data.aktif = Boolean(b.aktif)
    if (b?.tezgahIds !== undefined) {
      if (!Array.isArray(b.tezgahIds)) {
        return NextResponse.json({ ok: false, error: 'tezgahIds dizi olmalı' }, { status: 400 })
      }
      data.tezgahIds = b.tezgahIds.map(String)
    }
    return NextResponse.json({ ok: true, kiosk: await updateKiosk(id, data) })
  } catch (e) {
    return iproHata(e, 'Kiosk güncellenemedi')
  }
}
