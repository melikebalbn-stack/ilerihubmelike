import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { vardiyaKaydet } from '@/lib/pdks/vardiya-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, vardiya: await vardiyaKaydet(id, (await req.json()) ?? {}, userId) })
  } catch (e) {
    return pdksHata(e, 'Vardiya kaydedilemedi')
  }
}
