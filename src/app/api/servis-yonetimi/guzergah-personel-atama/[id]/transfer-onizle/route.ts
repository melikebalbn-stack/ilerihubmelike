import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { transferKapasiteOnizle } from '@/lib/servis-yonetimi/service'
import type { ServisPersonelAtamaTransferForm } from '@/lib/servis-yonetimi/validation'

export const dynamic = 'force-dynamic'

// POST .../guzergah-personel-atama/[id]/transfer-onizle — HİÇBİR ŞEY YAZMAZ.
// Serbest hedefte (herhangi aktif güzergâh + durak + dilim) kapasite etkisini döner:
// "<dilim>: personel a → b / koltuk k", aşımda asimVar. Yetki transferle AYNI (passive + create).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const pasifCheck = await requirePermission('servis.passive')
  if (pasifCheck.error) return pasifCheck.error
  const createCheck = await requirePermission('servis.create')
  if (createCheck.error) return createCheck.error
  try {
    const { id } = await params
    const body = (await request.json()) as ServisPersonelAtamaTransferForm
    const data = await transferKapasiteOnizle(id, body)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Önizleme alınamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
