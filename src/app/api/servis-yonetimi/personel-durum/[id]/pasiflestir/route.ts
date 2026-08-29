import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pasiflestirServisPersonelDurum } from '@/lib/servis-yonetimi/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as { bitisTarihi?: string }
    const data = await pasiflestirServisPersonelDurum(id, body.bitisTarihi || '', userId)
    return NextResponse.json({ ok: true, message: 'Servis kullanım durumu kaydı kapatıldı.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Servis kullanım durumu kaydı kapatılamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
