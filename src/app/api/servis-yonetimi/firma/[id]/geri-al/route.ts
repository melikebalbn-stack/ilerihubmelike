import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { geriAlServisFirma } from '@/lib/servis-yonetimi/service'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.restore')
  if (error) return error
  try {
    const { id } = await params
    const data = await geriAlServisFirma(id, userId)
    return NextResponse.json({ ok: true, message: 'Firma geri aktifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma geri aktifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
