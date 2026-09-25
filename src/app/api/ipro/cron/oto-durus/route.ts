import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runOtoDurus } from '@/lib/ipro/oto-durus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENTITY = 'OTO_DURUS' // SyteSyncDurum satırı yalnız kilit için (calisiyorAt) — Syteline verisi değil
const KILIT_MS = 5 * 60_000

// POST /api/ipro/cron/oto-durus[?dryRun=1] — otomatik duruş tespiti (Seçenek B tarayıcı). x-cron-secret korumalı.
// Kilit: SyteSyncDurum.calisiyorAt (mas/ayna deseni). İdempotent; kilit yalnız çift-iş önler.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  if (!dryRun) {
    const mevcut = await prisma.syteSyncDurum.findUnique({ where: { entity: ENTITY }, select: { calisiyorAt: true } })
    const taze = mevcut?.calisiyorAt && Date.now() - mevcut.calisiyorAt.getTime() < KILIT_MS
    if (taze) {
      return NextResponse.json({ ok: false, error: 'Oto-duruş zaten çalışıyor (kilit taze)', calisiyorAt: mevcut!.calisiyorAt }, { status: 409 })
    }
    await prisma.syteSyncDurum.upsert({
      where: { entity: ENTITY },
      update: { calisiyorAt: new Date() },
      create: { entity: ENTITY, calisiyorAt: new Date() },
    })
  }

  try {
    const ozet = await runOtoDurus({ dryRun })
    return NextResponse.json({ ok: true, ...ozet })
  } catch (e) {
    console.error('[oto-durus-cron] hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'cron hata' }, { status: 500 })
  } finally {
    if (!dryRun) {
      await prisma.syteSyncDurum.update({ where: { entity: ENTITY }, data: { calisiyorAt: null } }).catch(() => {})
    }
  }
}
