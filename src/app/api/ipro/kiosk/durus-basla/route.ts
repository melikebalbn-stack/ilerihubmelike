import { NextRequest } from 'next/server'
import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiForbidden, apiBadRequest } from '@/lib/api-response'

// POST /api/ipro/kiosk/durus-basla — body { tezgahId, personnelId, durusSebebiId }.
// Tezgah duruşu (açık iş ŞART DEĞİL). Tezgah başına tek açık duruş — partial unique
// (ipro_machine_downtime_acik_uq) ihlali → P2002 → 409.
export async function POST(req: NextRequest) {
  const { kiosk, error } = await requireKiosk()
  if (error) return error

  const body = await req.json().catch(() => null)
  const tezgahId = body?.tezgahId
  const personnelId = body?.personnelId
  const durusSebebiId = body?.durusSebebiId
  if (typeof tezgahId !== 'string' || typeof personnelId !== 'string' || typeof durusSebebiId !== 'string') {
    return apiBadRequest('tezgahId, personnelId ve durusSebebiId gerekli')
  }

  // GUVENLIK: tezgah kiosk'un bagli tezgahlarindan biri OLMALI.
  if (!kiosk.tezgahlar.some((k) => k.tezgah.id === tezgahId)) return apiForbidden()

  // Sebep OTORITER dogrulama — client'a guvenilmez. Kiosk'ta gosterilebilir sebep mi?
  // (aktif + uretimdeGosterilsin + yetkiliOnayGerekli=false — liste filtresiyle birebir.)
  const sebep = await prisma.iproDurusSebebi.findFirst({
    where: { id: durusSebebiId, aktif: true, uretimdeGosterilsin: true, yetkiliOnayGerekli: false },
    select: { id: true, ad: true, durusAktifkenIsBitirilemez: true },
  })
  if (!sebep) return apiBadRequest('Geçersiz veya kioskta kullanılamaz duruş sebebi')

  // Ac. Partial unique (acik_uq) ihlali → P2002 → 409.
  try {
    const durus = await prisma.iproMachineDowntime.create({
      data: { tezgahId, personnelId, durusSebebiId: sebep.id, baslangic: new Date(), kaynak: 'KIOSK' },
      select: { id: true, baslangic: true },
    })
    return apiSuccess(
      {
        id: durus.id,
        baslangic: durus.baslangic,
        sebepAd: sebep.ad,
        durusAktifkenIsBitirilemez: sebep.durusAktifkenIsBitirilemez,
      },
      201,
    )
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') return apiError('Bu tezgahta zaten açık duruş var', 409)
    throw e
  }
}
