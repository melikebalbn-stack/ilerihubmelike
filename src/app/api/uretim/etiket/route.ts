import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { generateMalzemeEtiketiPdf } from '@/lib/uretim/malzeme-etiketi-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/uretim/etiket — Malzeme Etiketi PDF'i (termal 100x80mm) döndürür.
 *
 * Yetki: uretim.bildirim (uretim-operator + super-admin; diğer IFS/uretim
 * endpoint'leriyle aynı). Operatör adı body'den DEĞİL, authenticated
 * session'dan (session.user.name).
 */
const BodySchema = z.object({
  orderNo: z.string().min(1, 'orderNo zorunlu'),
  operationNo: z.union([z.string(), z.number()]),
  operationDescription: z.string().nullish(),
  partNo: z.string().nullish(),
  partRev: z.string().nullish(),
  partDescription: z.string().nullish(),
  lot: z.string().min(1, 'lot zorunlu'),
  quantity: z.number(),
  location: z.string().nullish(),
  date: z.string().nullish(),
  site: z.string().nullish(),
})

export async function POST(request: NextRequest) {
  const { session, error } = await requirePermission('uretim.bildirim')
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON gövdesi' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      { status: 400 },
    )
  }

  const operator = session.user?.name || session.user?.email || 'Bilinmiyor'
  const d = parsed.data

  try {
    const pdf = await generateMalzemeEtiketiPdf({
      orderNo: d.orderNo,
      operationNo: d.operationNo,
      operationDescription: d.operationDescription ?? null,
      partNo: d.partNo ?? null,
      partRev: d.partRev ?? null,
      partDescription: d.partDescription ?? null,
      lot: d.lot,
      quantity: d.quantity,
      location: d.location ?? null,
      date: d.date ?? undefined,
      operator,
      site: d.site ?? null,
    })

    const fileName = `malzeme-etiketi-${d.orderNo}-${d.operationNo}.pdf`
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: `Etiket üretilemedi: ${message}` }, { status: 500 })
  }
}
