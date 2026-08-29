import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisDurak } from '@/lib/servis-yonetimi/service'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const data = await pasiflestirServisDurak(id)
    return NextResponse.json({ ok: true, message: 'Durak pasifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Durak pasifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
