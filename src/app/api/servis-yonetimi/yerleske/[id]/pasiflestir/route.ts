import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisYerleske } from '@/lib/servis-yonetimi/service'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const data = await pasiflestirServisYerleske(id)
    return NextResponse.json({ ok: true, message: 'Yerleşke pasifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Yerleşke pasifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
