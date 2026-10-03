import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { onayBayragiOku, pasiflestirHataYaniti } from '@/lib/servis-yonetimi/pasiflestir-yaniti'
import { pasiflestirServisSofor } from '@/lib/servis-yonetimi/service'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error

  try {
    const { id } = await context.params
    return NextResponse.json({ ok: true, data: await pasiflestirServisSofor(id, userId, { onay: await onayBayragiOku(request) }) })
  } catch (err) {
    return pasiflestirHataYaniti(err, 'Şoför pasifleştirilemedi.')
  }
}
