import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError } from '@/lib/api-response'
import { runPartSync } from '@/lib/entegrasyon/syteline/part-sync'
import { runIsEmriSync } from '@/lib/entegrasyon/syteline/is-emri-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/entegrasyon/syteline/calistir — panelden manuel tetikleme.
// body { dryRun?: boolean, batch?: number, entity?: 'MALZEME'|'IS_EMRI' }. Guard: entegrasyon.syteline.
// Cron ile aynı çekirdek; kilit YOK (manuel, kısa).
export async function POST(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const body = await req.json().catch(() => null)
  const dryRun = body?.dryRun === true
  const entity = body?.entity === 'IS_EMRI' ? 'IS_EMRI' : 'MALZEME'
  const b = Number(body?.batch)
  const batch = Number.isInteger(b) && b >= 1 && b <= 500 ? b : undefined
  try {
    const ozet = entity === 'IS_EMRI' ? await runIsEmriSync({ dryRun, batch }) : await runPartSync({ dryRun, batch })
    return apiSuccess(ozet)
  } catch (e) {
    return apiError((e as Error)?.message ?? 'Senkron çalıştırılamadı', 500)
  }
}
