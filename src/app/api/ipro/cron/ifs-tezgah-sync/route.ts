import { NextRequest, NextResponse } from 'next/server'
import { tezgahSenkronu } from '@/lib/ipro/tezgah-sync'

export const dynamic = 'force-dynamic'

// POST /api/ipro/cron/ifs-tezgah-sync — IFS makine kaynaklarını ILERIHub'a
// hizalar: yeni ekle + ad/WC değişmişse güncelle + backfill. PASİFLEME YOK.
// x-cron-secret korumalı (ifs-personel-sync deseni). Gecelik.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sonuc = await tezgahSenkronu()
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    console.error('[ipro-ifs-tezgah-sync] cron hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'cron hata' }, { status: 500 })
  }
}
