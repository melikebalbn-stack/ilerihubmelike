import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisSofor } from '@/lib/servis-yonetimi/service'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error

  try {
    const { id } = await context.params
    return NextResponse.json({ ok: true, data: await pasiflestirServisSofor(id, userId) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Şoför pasifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
