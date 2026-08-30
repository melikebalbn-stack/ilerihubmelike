import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { geriAlServisYerleske } from '@/lib/servis-yonetimi/service'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.restore')
  if (error) return error
  try {
    const { id } = await params
    const data = await geriAlServisYerleske(id, userId)
    return NextResponse.json({ ok: true, message: 'Yerleşke geri aktifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Yerleşke geri aktifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
