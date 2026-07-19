import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateTezgah, type TezgahGuncelle } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/ipro/yonetim/tezgahlar/{id} — ad / IFS alanları / aktif.
// kod DEĞİŞTİRİLEMEZ (MAS kimliği), ekleme-silme yok.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const body = (await request.json()) as TezgahGuncelle & { kod?: string }
    if (body.kod !== undefined) {
      return NextResponse.json({ ok: false, error: 'Tezgah kodu değiştirilemez (MAS kimliği)' }, { status: 400 })
    }
    const data: TezgahGuncelle = {}
    if (body.ad !== undefined) data.ad = String(body.ad).trim()
    if (body.ifsWorkCenterNo !== undefined) data.ifsWorkCenterNo = body.ifsWorkCenterNo || null
    if (body.ifsResourceId !== undefined) data.ifsResourceId = body.ifsResourceId || null
    if (body.aktif !== undefined) data.aktif = Boolean(body.aktif)
    return NextResponse.json({ ok: true, tezgah: await updateTezgah(id, data) })
  } catch (e) {
    return iproHata(e, 'Tezgah güncellenemedi')
  }
}
