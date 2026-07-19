import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateDurusTipi, type DurusTipiGirdi } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    const data: Partial<DurusTipiGirdi> = {}
    if (b?.kod !== undefined) data.kod = String(b.kod).trim()
    if (b?.ad !== undefined) data.ad = String(b.ad).trim()
    if (b?.teepOrder !== undefined) data.teepOrder = b.teepOrder === null || b.teepOrder === '' ? null : Number(b.teepOrder)
    if (b?.aktif !== undefined) data.aktif = Boolean(b.aktif)
    return NextResponse.json({ ok: true, tip: await updateDurusTipi(id, data) })
  } catch (e) {
    return iproHata(e, 'Duruş tipi güncellenemedi')
  }
}
