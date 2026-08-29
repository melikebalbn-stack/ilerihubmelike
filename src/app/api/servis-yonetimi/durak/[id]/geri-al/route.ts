import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { geriAlServisDurak } from '@/lib/servis-yonetimi/service'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.restore')
  if (error) return error
  try {
    const { id } = await params
    const data = await geriAlServisDurak(id)
    return NextResponse.json({ ok: true, message: 'Durak geri aktifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Durak geri aktifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
