import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError } from '@/lib/api-response'
import { runPartSync } from '@/lib/entegrasyon/syteline/part-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/entegrasyon/syteline/calistir — panelden manuel tetikleme. body { dryRun?: boolean }.
// Guard: entegrasyon.syteline. Cron ile aynı runPartSync; kilit YOK (manuel, kısa).
export async function POST(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const body = await req.json().catch(() => null)
  const dryRun = body?.dryRun === true
  // batch (1-500) — geçersiz/yok → undefined (SYTE_SYNC_BATCH env'e düşer).
  const b = Number(body?.batch)
  const batch = Number.isInteger(b) && b >= 1 && b <= 500 ? b : undefined
  try {
    const ozet = await runPartSync({ dryRun, batch })
    return apiSuccess(ozet)
  } catch (e) {
    return apiError((e as Error)?.message ?? 'Senkron çalıştırılamadı', 500)
  }
}
