import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { satirCikar, satirEkleVeRezerve } from '@/lib/ifs/malzeme-talebi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GUARD = ['depo.terminal.use', 'admin.system.manage']
const hata = (e: unknown) => NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS işlemi başarısız' }, { status: 502 })

const EkleSchema = z.object({
  stok: z.object({
    partNo: z.string().min(1),
    locationNo: z.string().min(1),
    lotBatchNo: z.string(),
    serialNo: z.string(),
    engChgLevel: z.string(),
    waivDevRejNo: z.string(),
    configurationId: z.string(),
    activitySeq: z.number(),
    handlingUnitId: z.number(),
  }),
  miktar: z.number().positive(),
})

// POST /api/depo/malzeme-talebi/{orderNo}/satir { stok, miktar } → satır ekle + okutulan stoktan rezerv. IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const { orderNo: ham } = await params
  const orderNo = decodeURIComponent(ham).trim()
  const parsed = EkleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz stok satırı / miktar' }, { status: 400 })
  const { stok, miktar } = parsed.data
  try {
    const satir = await satirEkleVeRezerve(orderNo, stok, miktar)
    await logDepoHareket({
      olay: 'MALZEME_TALEBI_REZERV',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: stok.partNo,
      lotBatchNo: stok.lotBatchNo || null,
      miktar,
      kaynakLok: stok.locationNo,
      orderNo,
      releaseNo: satir.releaseNo,
      lineItemNo: satir.lineItemNo,
      detay: { lineNo: satir.lineNo, stok },
    })
    return NextResponse.json({ ok: true, satir })
  } catch (e) {
    return hata(e)
  }
}

// DELETE /api/depo/malzeme-talebi/{orderNo}/satir?lineNo=&releaseNo=&lineItemNo= → rezervi geri al + satırı sil. IFS'e YAZAR.
export async function DELETE(request: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const { orderNo: ham } = await params
  const orderNo = decodeURIComponent(ham).trim()
  const sp = new URL(request.url).searchParams
  const lineNo = sp.get('lineNo')?.trim()
  const releaseNo = sp.get('releaseNo')?.trim()
  const lineItemNo = Number(sp.get('lineItemNo'))
  if (!lineNo || !releaseNo || !Number.isFinite(lineItemNo)) {
    return NextResponse.json({ ok: false, error: 'Satır anahtarı eksik' }, { status: 400 })
  }
  try {
    const { partNo, geriAlinan } = await satirCikar(orderNo, { lineNo, releaseNo, lineItemNo })
    await logDepoHareket({
      olay: 'MALZEME_TALEBI_CIKAR',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo,
      lotBatchNo: geriAlinan[0]?.lotBatchNo ?? null,
      miktar: geriAlinan.reduce((t, r) => t + r.rezerve, 0),
      kaynakLok: geriAlinan.map((r) => r.locationNo).join(',') || null,
      orderNo,
      releaseNo,
      lineItemNo,
      detay: { lineNo, geriAlinan },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}
