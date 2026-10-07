import { NextRequest, NextResponse } from 'next/server'
import { devamsizlikBildirimIsi } from '@/lib/pdks/devamsizlik-bildirim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/pdks-devamsizlik — sabah gelmeyen/geç bildirimi (amir + İV). x-cron-secret korumalı.
// ?dryRun=1 aday sayar, bildirim göndermez. Hafta sonu/tatil/saat erken/kapalı iken no-op.
// CRON: crontab'a "saatte bir" (ör. 0 * * * *) olarak eklenecek; modül pdks_devamsizlik_bildirim_acik=true ile açılır.
let calisiyor = false

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (calisiyor) return NextResponse.json({ ok: true, noop: true, sebep: 'önceki tur sürüyor' })
  calisiyor = true
  try {
    const sonuc = await devamsizlikBildirimIsi({ dryRun: req.nextUrl.searchParams.get('dryRun') === '1' })
    console.log(`[pdks-devamsizlik] ${JSON.stringify(sonuc)}`)
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    console.error('[pdks-devamsizlik] cron hata', e)
    return NextResponse.json({ ok: false, error: 'devamsızlık bildirim hata' }, { status: 500 })
  } finally {
    calisiyor = false
  }
}
