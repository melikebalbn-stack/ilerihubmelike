import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { okuyucuGuncelle, okuyucuSil, pdksHata } from '@/lib/pdks/cihaz-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    return NextResponse.json({ ok: true, okuyucu: await okuyucuGuncelle(id, b ?? {}, userId) })
  } catch (e) {
    return pdksHata(e, 'Okuyucu güncellenemedi')
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    await okuyucuSil(id, userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return pdksHata(e, 'Okuyucu silinemedi')
  }
}
