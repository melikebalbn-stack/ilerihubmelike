import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { atamaSil } from '@/lib/pdks/vardiya-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    await atamaSil(id, userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return pdksHata(e, 'Atama silinemedi')
  }
}
