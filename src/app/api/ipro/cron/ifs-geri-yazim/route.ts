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
      select: { id: true, ifsOrderNo: true, ifsOperationNo: true, kaynak: true, personnelId: true },
    })

    let basarili = 0
    let basarisiz = 0
    // HATA SEBEBİ (16.09.2026): 23/23 başarısız dönüyordu ama sebep yalnız kayıttaki
    // ifsCompleteHata'da kalıyordu; cron logunda görünmüyordu. Dağılım + örnek döner ve loglanır.
    const hataDagilimi: Record<string, number> = {}
    const ornekler: Array<{ id: string; sicil: string | null; isEmri: string | null; op: number | null; kaynak: string | null; hata: string }> = []
    // Personnel.personnelId FK'sız çıplak String (IPRO deseni) — sicil ayrı sorguyla.
    const sicilMap = new Map((await prisma.personnel.findMany({ where: { id: { in: bekleyenler.map((b) => b.personnelId) } }, select: { id: true, sicilNo: true } })).map((p) => [p.id, p.sicilNo]))
    // SIRAYLA (paralel değil) — IFS'i/token'ı boğmamak için for-await.
    for (const b of bekleyenler) {
      const r = await birKaydiIfseYaz(b.id)
      if (r.ok) { basarili++; continue }
      basarisiz++
      // ORA kodu/alt kodu anahtar olsun ("ORA-20110: ShprepTransactionUtil.INVALIDOP: Invalid operation.")
      const anahtar = (r.hata ?? 'bilinmiyor').replace(/^[\s\S]*?(ORA-\d+: [A-Za-z.]+)[\s\S]*$/, '$1').slice(0, 120)
      hataDagilimi[anahtar] = (hataDagilimi[anahtar] ?? 0) + 1
      if (ornekler.length < 5) ornekler.push({ id: b.id, sicil: sicilMap.get(b.personnelId) ?? null, isEmri: b.ifsOrderNo, op: b.ifsOperationNo, kaynak: b.kaynak, hata: (r.hata ?? '').slice(0, 200) })
    }
    if (basarisiz > 0) console.error(`[ipro-ifs-geri-yazim] ${basarisiz}/${bekleyenler.length} başarısız — ${JSON.stringify(hataDagilimi)}`)

    return NextResponse.json({ ok: true, taranan: bekleyenler.length, basarili, basarisiz, hataDagilimi, ornekler })
  } catch (e) {
    // Endpoint seviyesi garanti — bir kaydın patlaması cron'u düşürmesin.
    console.error('[ipro-ifs-geri-yazim] cron hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'cron hata' }, { status: 500 })
  }
}
