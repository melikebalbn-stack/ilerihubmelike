import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisGuzergahAracVarsayilan } from '@/lib/servis-yonetimi/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as { bitisTarihi?: string }
    const data = await pasiflestirServisGuzergahAracVarsayilan(id, body.bitisTarihi || '', userId)
    return NextResponse.json({ ok: true, message: 'Varsayılan araç ataması kapatıldı.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Varsayılan araç ataması kapatılamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
