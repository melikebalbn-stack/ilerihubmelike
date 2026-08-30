import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { guncelleServisPersonelAtama } from '@/lib/servis-yonetimi/service'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.edit')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as { bitisTarihi?: string | null }
    const data = await guncelleServisPersonelAtama(id, body, userId)
    return NextResponse.json({ ok: true, message: 'Personel ataması güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Personel ataması güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
