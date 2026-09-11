import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api-response'
import { eksiklerAnalizi } from '@/lib/entegrasyon/syteline/part-sync'
import { isEmriEksiklerAnalizi } from '@/lib/entegrasyon/syteline/is-emri-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/entegrasyon/syteline/eksikler?entity=MALZEME|IS_EMRI — dryRun mantığıyla (DB'ye yazmadan)
// hata dağılımı: her sebep için { sebep, adet, kategori, ornekler(ilk5) }. Guard: entegrasyon.syteline.
export async function GET(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const entity = req.nextUrl.searchParams.get('entity') ?? 'MALZEME'
  if (entity !== 'MALZEME' && entity !== 'IS_EMRI') return apiBadRequest('entity MALZEME veya IS_EMRI olmalı')
  try {
    const sonuc = entity === 'IS_EMRI' ? await isEmriEksiklerAnalizi() : await eksiklerAnalizi()
    return apiSuccess({ entity, ...sonuc })
  } catch (e) {
    return apiError((e as Error)?.message ?? 'Eksikler analizi başarısız', 500)
  }
}
