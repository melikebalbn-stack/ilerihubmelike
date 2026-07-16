import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { openSession } from '@/lib/ipro/operator-session'
import { OperatorIdentifyError } from '@/lib/ipro/identify-operator'
import { apiSuccess, apiError, apiForbidden, apiBadRequest } from '@/lib/api-response'

// OperatorIdentifyError.code -> HTTP durum kodu.
const IDENTIFY_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  INACTIVE: 403,
  NO_SICIL: 422,
  METHOD_NOT_ENABLED: 403,
}

// POST /api/ipro/kiosk/oturum — body { personnelId, tezgahId }. Operator oturumu acar.
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const personnelId = body?.personnelId
  const tezgahId = body?.tezgahId
  if (typeof personnelId !== 'string' || typeof tezgahId !== 'string') {
    return apiBadRequest('personnelId ve tezgahId gerekli')
  }

  // GUVENLIK: tezgah kiosk'un bagli tezgahlarindan biri OLMALI (baska tezgaha oturum acamasin).
  const izinli = kiosk.tezgahlar.some((kt) => kt.tezgah.id === tezgahId)
  if (!izinli) return apiForbidden()

  try {
    const session = await openSession({ method: 'LIST', personnelId, tezgahId })
    return apiSuccess({ session })
  } catch (err) {
    if (err instanceof OperatorIdentifyError) {
      return apiError(err.message, IDENTIFY_STATUS[err.code] ?? 400)
    }
    throw err
  }
}
