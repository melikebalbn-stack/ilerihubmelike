import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { kartGecmisi } from '@/lib/pdks/kart-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/kartlar/[id]/gecmis — kartın denetim olayları + panel senkron satırları (pdks.view)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(['pdks.view', 'pdks.manage'])
  if (error) return error
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, ...(await kartGecmisi(id)) })
  } catch (e) {
    return pdksHata(e, 'Kart geçmişi alınamadı')
  }
}
