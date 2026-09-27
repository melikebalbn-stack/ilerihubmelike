import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SISTEM_AKTOR_ID } from '@/lib/audit-log'
import { bugunStr } from '@/lib/pdks/puantaj-servis'
import { hakEdisIsi } from '@/lib/izin/hak-edis-isi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/izin-hak-edis — günlük yıldönümü hak edişi (idempotent: HAK:<personel>:<yıl>).
// x-cron-secret korumalı. ?geriGun=N (0-31, varsayılan 7) pencere; ?dryRun=1 yazmadan sayar.
// Geçiş tarihi (izin_gecis_tarihi) yoksa HİÇBİR ŞEY yazmaz — ayar açılış import'unda yazılır.
// CRON: henüz crontab'a EKLENMEDİ (canlıya geçiş günü, açılış import'undan SONRA eklenir).
let calisiyor = false

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (calisiyor) return NextResponse.json({ ok: true, noop: true, sebep: 'önceki tur sürüyor' })
  calisiyor = true
  try {
    const p = req.nextUrl.searchParams
    const gg = Number(p.get('geriGun'))
    const geriGun = p.get('geriGun') !== null && Number.isInteger(gg) ? Math.min(31, Math.max(0, gg)) : 7
    const sonuc = await hakEdisIsi(prisma, { bugun: bugunStr(), geriGun, dryRun: p.get('dryRun') === '1', aktorId: SISTEM_AKTOR_ID })
    console.log(`[izin-hak-edis] ${JSON.stringify(sonuc)}`)
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    console.error('[izin-hak-edis] cron hata', e)
    return NextResponse.json({ ok: false, error: 'hak ediş hata' }, { status: 500 })
  } finally {
    calisiyor = false
  }
}
