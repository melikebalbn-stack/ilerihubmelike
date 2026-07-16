import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { apiSuccess } from '@/lib/api-response'

// GET /api/ipro/kiosk/tezgahlar — kiosk'un bagli tezgah listesi (id, kod, ad).
export async function GET() {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const tezgahlar = kiosk.tezgahlar.map((kt) => ({
    id: kt.tezgah.id,
    kod: kt.tezgah.kod,
    ad: kt.tezgah.ad,
  }))

  return apiSuccess({ tezgahlar })
}
