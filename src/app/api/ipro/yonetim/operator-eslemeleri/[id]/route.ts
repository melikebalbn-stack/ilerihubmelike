import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { setOperatorEslemeAktif, deleteOperatorEsleme } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH — eşlemeyi pasifle/aktifle (geçmiş korunur, tercih edilen yol)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const body = await request.json()
    if (typeof body?.aktif !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'aktif (boolean) gerekli' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, esleme: await setOperatorEslemeAktif(id, body.aktif) })
  } catch (e) {
    return iproHata(e, 'Eşleme güncellenemedi')
  }
}

// DELETE — eşlemeyi tamamen kaldır (yanlış girilmiş kayıt için)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, esleme: await deleteOperatorEsleme(id) })
  } catch (e) {
    return iproHata(e, 'Eşleme silinemedi')
  }
}
