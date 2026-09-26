import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { iptalEt } from '@/lib/ifs/toplu-tasima'
import { GUARD, fisNo, hata } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/toplu-tasima/{no}/iptal → IptalEt (yalnız Yeni fiş). IFS'e YAZAR.
export async function POST(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = fisNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz fiş no' }, { status: 400 })
  try {
    const durum = await iptalEt(no)
    await logDepoHareket({ olay: 'TOPLU_TASIMA_IPTAL', userId, kullaniciAd: session.user.name ?? 'Operatör', partNo: '-', orderNo: String(no) })
    return NextResponse.json({ ok: true, durum })
  } catch (e) {
    return hata(e)
  }
}
