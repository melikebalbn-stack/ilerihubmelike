import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { onayBayragiOku } from '@/lib/servis-yonetimi/pasiflestir-yaniti'
import { geriAlServisFirma } from '@/lib/servis-yonetimi/service'

// Gövde OPSİYONEL: yalnız `{ "zincirGeriAl": true }` firmayla BİRLİKTE pasifleşen
// araç/şoförleri de geri getirir (A5). Gövdesiz istek yalnız firmayı geri alır.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.restore')
  if (error) return error
  try {
    const { id } = await params
    const zincirGeriAl = await onayBayragiOku(request, 'zincirGeriAl')
    const data = await geriAlServisFirma(id, userId, { zincirGeriAl })
    return NextResponse.json({ ok: true, message: 'Firma geri aktifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma geri aktifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
