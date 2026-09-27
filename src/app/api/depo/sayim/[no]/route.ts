import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { raporGetir } from '@/lib/ifs/sayim'
import { GUARD, hata, raporNo } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sayim/{no} → { ok, rapor } — satırlarda sistem miktarı YOK (kör sayım). SADECE OKUMA.
export async function GET(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const no = raporNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz rapor no' }, { status: 400 })
  try {
    const rapor = await raporGetir(no)
    if (!rapor) return NextResponse.json({ ok: false, error: `Sayım raporu bulunamadı: ${no}` }, { status: 404 })
    return NextResponse.json({ ok: true, rapor })
  } catch (e) {
    return hata(e)
  }
}
