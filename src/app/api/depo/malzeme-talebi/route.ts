import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { talepGetir, talepOlustur } from '@/lib/ifs/malzeme-talebi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GUARD = ['depo.terminal.use', 'admin.system.manage']
const hata = (e: unknown) => NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS işlemi başarısız' }, { status: 502 })

// GET /api/depo/malzeme-talebi?orderNo= → { ok, talep } (başlık + satırlar + rezervler). Bulunamadı → 404.
export async function GET(request: Request) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const orderNo = new URL(request.url).searchParams.get('orderNo')?.trim()
  if (!orderNo) return NextResponse.json({ ok: false, error: 'Talep no gerekli' }, { status: 400 })
  try {
    const talep = await talepGetir(orderNo)
    if (!talep) return NextResponse.json({ ok: false, error: `Talep bulunamadı: ${orderNo}` }, { status: 404 })
    return NextResponse.json({ ok: true, talep })
  } catch (e) {
    return hata(e)
  }
}

const OlusturSchema = z.object({
  intCustomerNo: z.string().trim().min(1),
  destinationId: z.string().trim().min(1),
  not: z.string().trim().max(2000).optional(),
})

// POST /api/depo/malzeme-talebi { intCustomerNo, destinationId, not? } → { ok, orderNo }. IFS'e YAZAR.
export async function POST(request: Request) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const parsed = OlusturSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dahili müşteri ve varış yeri gerekli' }, { status: 400 })
  try {
    const { intCustomerNo, destinationId, not } = parsed.data
    const orderNo = await talepOlustur(intCustomerNo, destinationId, not)
    await logDepoHareket({
      olay: 'MALZEME_TALEBI_OLUSTUR',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: '-',
      orderNo,
      detay: { intCustomerNo, destinationId, not: not ?? null },
    })
    return NextResponse.json({ ok: true, orderNo })
  } catch (e) {
    return hata(e)
  }
}
