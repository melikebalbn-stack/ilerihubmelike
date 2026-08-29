import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisSorumlusu } from '@/lib/servis-yonetimi/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as { bitisTarihi?: string }
    const data = await pasiflestirServisSorumlusu(id, body.bitisTarihi || '', userId)
    return NextResponse.json({ ok: true, message: 'Servis sorumlusu ataması kapatıldı.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Servis sorumlusu ataması kapatılamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
