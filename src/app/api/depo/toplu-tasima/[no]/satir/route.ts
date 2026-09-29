import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ondalikUygun } from '@/lib/depo/miktar'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { fisGetir, satirEkle, satirSil } from '@/lib/ifs/toplu-tasima'
import { GUARD, fisNo, hata, StokSchema } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/toplu-tasima/{no}/satir { stok, miktar } → AddLine. IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = fisNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz fiş no' }, { status: 400 })
  const parsed = z.object({ stok: StokSchema, miktar: z.number().positive().refine(ondalikUygun) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz stok satırı / miktar' }, { status: 400 })
  const { stok, miktar } = parsed.data
  try {
    await satirEkle(no, stok, miktar)
    const fis = await fisGetir(no)
    await logDepoHareket({
      olay: 'TOPLU_TASIMA_EKLE',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: stok.partNo,
      lotBatchNo: stok.lotBatchNo || null,
      miktar,
      kaynakLok: stok.locationNo,
      hedefLok: fis?.varisLok ?? null,
      orderNo: String(no),
      detay: { stok },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}

// DELETE /api/depo/toplu-tasima/{no}/satir { stok } → fiş satırını sil. IFS'e YAZAR.
export async function DELETE(request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = fisNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz fiş no' }, { status: 400 })
  const parsed = z.object({ stok: StokSchema }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz satır' }, { status: 400 })
  try {
    const s = await satirSil(no, parsed.data.stok)
    await logDepoHareket({
      olay: 'TOPLU_TASIMA_SIL',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: s.partNo,
      lotBatchNo: s.lotBatchNo || null,
      miktar: s.miktar,
      kaynakLok: s.locationNo,
      orderNo: String(no),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}
