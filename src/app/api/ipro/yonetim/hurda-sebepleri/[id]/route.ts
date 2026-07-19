import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateHurdaSebebi, type HurdaSebebiGirdi } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BOOL_ALANLAR = [
  'uretimHurdaRework', 'rework', 'hurda', 'bilesenHurdaRework',
  'oeeEtkiler', 'yorumZorunlu', 'sinyalsizGiris', 'aktif',
] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    const data: Partial<HurdaSebebiGirdi> = {}
    if (b?.kod !== undefined) data.kod = String(b.kod).trim()
    if (b?.ad !== undefined) data.ad = String(b.ad).trim()
    for (const alan of ['erpKodu', 'grupKodu', 'grubu'] as const) {
      if (b?.[alan] !== undefined) data[alan] = b[alan] || null
    }
    for (const alan of BOOL_ALANLAR) {
      if (b?.[alan] !== undefined) data[alan] = Boolean(b[alan])
    }
    return NextResponse.json({ ok: true, sebep: await updateHurdaSebebi(id, data) })
  } catch (e) {
    return iproHata(e, 'Hurda sebebi güncellenemedi')
  }
}
