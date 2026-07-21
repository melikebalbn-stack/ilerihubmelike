import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'

// GET /api/ipro/kiosk/durus-sebepleri — kiosk duruş sebep listesi (duruş başlat gridi).
// Filtre: aktif + uretimdeGosterilsin + yetkiliOnayGerekli=false. Onay gerektiren
// sebepler bu fazda GİZLİ (kiosk'ta onay mekanizması yok → FAZ sonrası backlog).
// durusAktifkenIsBitirilemez döner: UI iş-bitir kilidini bundan bilir.
export async function GET() {
  const { error } = await requireKiosk()
  if (error) return error

  const sebepler = await prisma.iproDurusSebebi.findMany({
    where: { aktif: true, uretimdeGosterilsin: true, yetkiliOnayGerekli: false },
    select: { id: true, kod: true, ad: true, renkKodu: true, durusAktifkenIsBitirilemez: true },
    orderBy: { kod: 'asc' },
  })

  return apiSuccess({ sebepler })
}
