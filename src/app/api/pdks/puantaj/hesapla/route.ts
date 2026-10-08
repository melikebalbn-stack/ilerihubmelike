import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { PdksGirdiHatasi } from '@/lib/pdks/cihaz-yonetim'
import { GUN_DESENI, bugunStr, gunuHesapla, araligiHesapla } from '@/lib/pdks/puantaj-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/puantaj/hesapla — ekrandan "Yeniden hesapla" (pdks.manage). Kilitli satırlar atlanır.
//   Tek gün: {gun}.  Aralık (ör. tüm ay): {bas, bit} — en çok 31 gün, bit bugünü aşamaz.
export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    const bugun = bugunStr()

    // Aralık modu
    if (typeof b?.bas === 'string' && typeof b?.bit === 'string') {
      if (!GUN_DESENI.test(b.bas) || !GUN_DESENI.test(b.bit)) throw new PdksGirdiHatasi('bas/bit YYYY-MM-DD olmalı')
      if (b.bas > b.bit) throw new PdksGirdiHatasi('bas, bit\'ten büyük olamaz')
      const bit = b.bit > bugun ? bugun : b.bit // geleceği hesaplama
      const gunSayisi = Math.round((Date.parse(bit) - Date.parse(b.bas)) / 86400_000) + 1
      if (gunSayisi > 31) throw new PdksGirdiHatasi('Aralık en çok 31 gün olabilir')
      const ozet = await araligiHesapla(prisma, b.bas, bit)
      const toplam = ozet.reduce(
        (a, g) => ({ yazilan: a.yazilan + Number(g.yazilan), kilitliAtlanan: a.kilitliAtlanan + Number(g.kilitliAtlanan) }),
        { yazilan: 0, kilitliAtlanan: 0 },
      )
      await logAuditEvent({ action: 'PDKS_PUANTAJ_HESAPLANDI', actorId: userId, targetType: 'PDKS_PUANTAJ', targetId: `${b.bas}..${bit}`, details: toplam })
      return NextResponse.json({ ok: true, bas: b.bas, bit, gunSayisi: ozet.length, ...toplam })
    }

    // Tek gün modu
    const gun = typeof b?.gun === 'string' ? b.gun : ''
    if (!GUN_DESENI.test(gun)) throw new PdksGirdiHatasi('gün YYYY-MM-DD olmalı')
    if (gun > bugun) throw new PdksGirdiHatasi('Gelecek gün hesaplanamaz')
    const { sonuclar: _s, ...r } = await gunuHesapla(prisma, gun)
    await logAuditEvent({ action: 'PDKS_PUANTAJ_HESAPLANDI', actorId: userId, targetType: 'PDKS_PUANTAJ', targetId: gun, details: r })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return pdksHata(e, 'Puantaj hesaplanamadı')
  }
}
