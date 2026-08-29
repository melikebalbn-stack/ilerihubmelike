import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { geriAlServisPersonelDurum } from '@/lib/servis-yonetimi/service'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.restore')
  if (error) return error
  try {
    const { id } = await params
    const data = await geriAlServisPersonelDurum(id, userId)
    return NextResponse.json({ ok: true, message: 'Servis kullanım durumu kaydı geri alındı.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Servis kullanım durumu kaydı geri alınamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
