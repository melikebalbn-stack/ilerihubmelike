import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { atamaYap } from '@/lib/pdks/vardiya-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/vardiyalar/atama {vardiyaId, baslangic, bitis?, personnelId | departmentId} (pdks.manage)
export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await atamaYap((await req.json()) ?? {}, userId)) })
  } catch (e) {
    return pdksHata(e, 'Atama yapılamadı')
  }
}
