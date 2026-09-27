import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { molaKaydet } from '@/lib/pdks/vardiya-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, mola: await molaKaydet(null, (await req.json()) ?? {}, userId) }, { status: 201 })
  } catch (e) {
    return pdksHata(e, 'Mola kaydedilemedi')
  }
}
