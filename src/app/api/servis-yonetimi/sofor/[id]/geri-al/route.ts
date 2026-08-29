import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { geriAlServisSofor } from '@/lib/servis-yonetimi/service'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.restore')
  if (error) return error

  try {
    const { id } = await context.params
    return NextResponse.json({ ok: true, data: await geriAlServisSofor(id) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Şoför geri alınamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
