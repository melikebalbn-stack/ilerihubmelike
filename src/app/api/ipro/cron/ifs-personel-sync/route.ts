import { NextRequest, NextResponse } from 'next/server'
import { ifsPersonelSenkronu } from '@/lib/ipro/ifs-personel-sync'

export const dynamic = 'force-dynamic'

// POST /api/ipro/cron/ifs-personel-sync — ILERIHub operatörlerini IFS'te employee
// olarak kurar (3 katman, idempotent) ve yetkisi kalkanları pasifleştirir.
// Gecelik çalışır. x-cron-secret korumalı (ifs-geri-yazim deseni).
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sonuc = await ifsPersonelSenkronu()
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    console.error('[ipro-ifs-personel-sync] cron hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'cron hata' }, { status: 500 })
  }
}
