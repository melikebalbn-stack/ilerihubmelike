import { requireKiosk } from '@/lib/ipro/require-kiosk'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'

// GET /api/ipro/kiosk/hurda-sebepleri — aktif hurda sebepleri (bitir ekranı, hurda>0 seçimi).
export async function GET() {
  const { error } = await requireKiosk()
  if (error) return error

  const sebepler = await prisma.iproHurdaSebebi.findMany({
    where: { aktif: true },
    select: { kod: true, ad: true },
    orderBy: { kod: 'asc' },
  })

  return apiSuccess({ sebepler })
}
