import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runIsEmriSync } from '@/lib/entegrasyon/syteline/is-emri-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENTITY = 'IS_EMRI'
const KILIT_MS = 15 * 60_000 // 15 dk'dan eski calisiyorAt → bayat, yoksay

// POST /api/entegrasyon/syteline/cron/is-emri[?dryRun=1&batch=N] — Syteline→IFS iş emri senkronu.
// x-cron-secret korumalı; kilit deseni malzeme cron'u ile aynı (SyteSyncDurum.calisiyorAt).
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const batchRaw = Number(req.nextUrl.searchParams.get('batch'))
  const batch = Number.isInteger(batchRaw) && batchRaw >= 1 && batchRaw <= 500 ? batchRaw : undefined

  if (!dryRun) {
    const mevcut = await prisma.syteSyncDurum.findUnique({ where: { entity: ENTITY }, select: { calisiyorAt: true } })
    const taze = mevcut?.calisiyorAt && Date.now() - mevcut.calisiyorAt.getTime() < KILIT_MS
    if (taze) {
      return NextResponse.json(
        { ok: false, error: 'Senkron zaten çalışıyor (kilit taze)', calisiyorAt: mevcut!.calisiyorAt },
        { status: 409 },
      )
    }
    await prisma.syteSyncDurum.upsert({
      where: { entity: ENTITY },
      update: { calisiyorAt: new Date() },
      create: { entity: ENTITY, calisiyorAt: new Date() },
    })
  }

  try {
    const ozet = await runIsEmriSync({ dryRun, batch })
    return NextResponse.json({ ok: true, ...ozet })
  } catch (e) {
    console.error('[syteline-isemri-cron] hata', e)
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'cron hata' }, { status: 500 })
  } finally {
    if (!dryRun) {
      await prisma.syteSyncDurum.update({ where: { entity: ENTITY }, data: { calisiyorAt: null } }).catch(() => {})
    }
  }
}
