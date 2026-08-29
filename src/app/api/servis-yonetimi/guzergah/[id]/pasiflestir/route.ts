import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisGuzergah } from '@/lib/servis-yonetimi/service'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.passive')
  if (error) return error
  try {
    const { id } = await params
    const data = await pasiflestirServisGuzergah(id)
    return NextResponse.json({ ok: true, message: 'Güzergâh pasifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Güzergâh pasifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
