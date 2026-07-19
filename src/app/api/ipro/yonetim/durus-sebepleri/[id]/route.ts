import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateDurusSebebi, type DurusSebebiGirdi } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BOOL_ALANLAR = [
  'planli', 'uretimDisi', 'setupDurusu', 'plcKilitle', 'askiyaAl',
  'makineKaynakli', 'operatorKaynakli', 'yetkiliOnayGerekli',
  'durusAktifkenIsBitirilemez', 'uretimdeGosterilsin', 'aktif',
] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    const data: Partial<DurusSebebiGirdi> = {}
    if (b?.kod !== undefined) data.kod = String(b.kod).trim()
    if (b?.ad !== undefined) data.ad = String(b.ad).trim()
    if (b?.bitisTipi !== undefined) data.bitisTipi = String(b.bitisTipi).trim()
    for (const alan of ['erpKodu', 'tipId', 'renkKodu', 'temelSebep'] as const) {
      if (b?.[alan] !== undefined) data[alan] = b[alan] || null
    }
    for (const alan of BOOL_ALANLAR) {
      if (b?.[alan] !== undefined) data[alan] = Boolean(b[alan])
    }
    return NextResponse.json({ ok: true, sebep: await updateDurusSebebi(id, data) })
  } catch (e) {
    return iproHata(e, 'Duruş sebebi güncellenemedi')
  }
}
