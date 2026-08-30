import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisSeferDilimi } from '@/lib/servis-yonetimi/service'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error
  try {
    const { id } = await params
    const data = await pasiflestirServisSeferDilimi(id, userId)
    return NextResponse.json({ ok: true, message: 'Sefer dilimi pasifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sefer dilimi pasifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
