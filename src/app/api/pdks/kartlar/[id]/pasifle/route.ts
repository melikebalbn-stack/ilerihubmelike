import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { kartPasifle } from '@/lib/pdks/kart-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/kartlar/[id]/pasifle {neden: KAYIP|BOZUK|DEGISTI|IPTAL} — kart PASİF, panelden
// silinmek üzere SILINECEK (öncelikli). Denetim kaydı yazılır. (pdks.manage)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    await kartPasifle(id, b ?? {}, userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return pdksHata(e, 'Kart pasiflenemedi')
  }
}
