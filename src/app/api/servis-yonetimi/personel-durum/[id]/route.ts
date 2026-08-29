import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { guncelleServisPersonelDurum } from '@/lib/servis-yonetimi/service'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.edit')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as { bitisTarihi?: string | null; neden?: string | null }
    const data = await guncelleServisPersonelDurum(id, body, userId)
    return NextResponse.json({ ok: true, message: 'Servis kullanım durumu kaydı güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Servis kullanım durumu kaydı güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
