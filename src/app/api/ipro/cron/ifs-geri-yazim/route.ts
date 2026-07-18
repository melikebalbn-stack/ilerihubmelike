import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { birKaydiIfseYaz } from '@/lib/ipro/ifs-geri-yazim'

export const dynamic = 'force-dynamic'

// POST /api/ipro/cron/ifs-geri-yazim — bekleyen (KAPALI, ifsCompleteYazildi=false, qtyComplete>0)
// üretim kayıtlarını IFS'e yazar (birKaydiIfseYaz). x-cron-secret korumalı (check-overdue deseni).
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Bekleyenler: en fazla 50, en eski önce. qtyComplete>0 — yazılacak iyi yoksa cron'u meşgul etme.
    const bekleyenler = await prisma.iproProductionLog.findMany({
      where: { durum: 'KAPALI', ifsCompleteYazildi: false, qtyComplete: { gt: 0 } },
      orderBy: { bitirildiAt: 'asc' },
      take: 50,
      select: { id: true },
    })

    let basarili = 0
    let basarisiz = 0
    // SIRAYLA (paralel değil) — IFS'i/token'ı boğmamak için for-await.
    for (const { id } of bekleyenler) {
      const r = await birKaydiIfseYaz(id)
      if (r.ok) basarili++
      else basarisiz++
    }

    return NextResponse.json({ ok: true, taranan: bekleyenler.length, basarili, basarisiz })
  } catch (e) {
    // Endpoint seviyesi garanti — bir kaydın patlaması cron'u düşürmesin.
    console.error('[ipro-ifs-geri-yazim] cron hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'cron hata' }, { status: 500 })
  }
}
