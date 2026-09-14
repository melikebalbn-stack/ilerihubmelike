import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMasAyna } from '@/lib/entegrasyon/mas/ayna'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENTITY = 'MAS_AYNA' // SyteSyncDurum satırı yalnız kilit için (calisiyorAt) — Syteline verisi değil
const KILIT_MS = 15 * 60_000

// POST /api/ipro/mas/cron/ayna[?dryRun=1] — MAS→IPRO ayna senkronu. x-cron-secret korumalı.
// Kilit: SyteSyncDurum.calisiyorAt (cron/is-emri deseni). Ayna idempotent; kilit yalnız çift-iş önler.
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
      return NextResponse.json({ ok: false, error: 'MAS ayna zaten çalışıyor (kilit taze)', calisiyorAt: mevcut!.calisiyorAt }, { status: 409 })
    }
    await prisma.syteSyncDurum.upsert({
      where: { entity: ENTITY },
      update: { calisiyorAt: new Date() },
      create: { entity: ENTITY, calisiyorAt: new Date() },
    })
  }

  try {
    const ozet = await runMasAyna({ dryRun })
    return NextResponse.json({ ok: true, ...ozet })
  } catch (e) {
    console.error('[mas-ayna-cron] hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'cron hata' }, { status: 500 })
  } finally {
    if (!dryRun) {
      await prisma.syteSyncDurum.update({ where: { entity: ENTITY }, data: { calisiyorAt: null } }).catch(() => {})
    }
  }
}
