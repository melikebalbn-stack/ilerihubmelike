import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { PdksGirdiHatasi } from '@/lib/pdks/cihaz-yonetim'
import { GUN_DESENI, bugunStr, gunuHesapla } from '@/lib/pdks/puantaj-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/puantaj/hesapla {gun} — ekrandan "Yeniden hesapla" (pdks.manage). Kilitli satırlar atlanır.
export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    const gun = typeof b?.gun === 'string' ? b.gun : ''
    if (!GUN_DESENI.test(gun)) throw new PdksGirdiHatasi('gün YYYY-MM-DD olmalı')
    if (gun > bugunStr()) throw new PdksGirdiHatasi('Gelecek gün hesaplanamaz')
    const { sonuclar: _s, ...r } = await gunuHesapla(prisma, gun)
    await logAuditEvent({ action: 'PDKS_PUANTAJ_HESAPLANDI', actorId: userId, targetType: 'PDKS_PUANTAJ', targetId: gun, details: r })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return pdksHata(e, 'Puantaj hesaplanamadı')
  }
}
