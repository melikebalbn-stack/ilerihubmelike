import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { prisma } from '@/lib/prisma'
import { PdksGirdiHatasi } from '@/lib/pdks/cihaz-yonetim'
import { GUN_DESENI, kilitDegistir } from '@/lib/pdks/puantaj-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/puantaj/kilit {bas, bit, kilitli} — kilitli gün yeniden hesaplanmaz. Denetim kaydı yazar. (pdks.manage)
export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    if (!GUN_DESENI.test(String(b?.bas)) || !GUN_DESENI.test(String(b?.bit))) throw new PdksGirdiHatasi('bas/bit YYYY-MM-DD olmalı')
    if (typeof b?.kilitli !== 'boolean') throw new PdksGirdiHatasi('kilitli true/false olmalı')
    return NextResponse.json({ ok: true, ...(await kilitDegistir(prisma, b.bas, b.bit, b.kilitli, userId)) })
  } catch (e) {
    return pdksHata(e, 'Kilit değiştirilemedi')
  }
}
