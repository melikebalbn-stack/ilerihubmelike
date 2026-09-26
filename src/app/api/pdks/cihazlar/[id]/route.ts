import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { cihazGuncelle, cihazSil, pdksHata } from '@/lib/pdks/cihaz-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    return NextResponse.json({ ok: true, cihaz: await cihazGuncelle(id, b ?? {}, userId) })
  } catch (e) {
    return pdksHata(e, 'Cihaz güncellenemedi')
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    await cihazSil(id, userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return pdksHata(e, 'Cihaz silinemedi')
  }
}
