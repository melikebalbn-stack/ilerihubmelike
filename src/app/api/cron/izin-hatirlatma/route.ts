import { NextRequest, NextResponse } from 'next/server'
import { hatirlatmaIsi } from '@/lib/izin/hatirlatma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/izin-hatirlatma — onay hatırlatmaları (İzin Faz 6). x-cron-secret korumalı. ?dryRun=1 aday sayar,
// satır yazmaz, mail göndermez. Hafta sonu / tatil / 08:30 öncesi erteler; izin_talep_acik kapalıyken no-op.
// CRON: henüz crontab'a EKLENMEDİ — canlıya geçiş listesinde "saatte bir" satırı olarak (izin_talep_acik=true ile birlikte).
let calisiyor = false

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (calisiyor) return NextResponse.json({ ok: true, noop: true, sebep: 'önceki tur sürüyor' })
  calisiyor = true
  try {
    const sonuc = await hatirlatmaIsi({ dryRun: req.nextUrl.searchParams.get('dryRun') === '1' })
    console.log(`[izin-hatirlatma] ${JSON.stringify(sonuc)}`)
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    console.error('[izin-hatirlatma] cron hata', e)
    return NextResponse.json({ ok: false, error: 'hatırlatma hata' }, { status: 500 })
  } finally {
    calisiyor = false
  }
}
