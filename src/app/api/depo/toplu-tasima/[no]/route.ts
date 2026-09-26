import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { fisGetir } from '@/lib/ifs/toplu-tasima'
import { GUARD, fisNo, hata } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/toplu-tasima/{no} → { ok, fis } (başlık + satırlar). SADECE OKUMA.
export async function GET(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const no = fisNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz fiş no' }, { status: 400 })
  try {
    const fis = await fisGetir(no)
    if (!fis) return NextResponse.json({ ok: false, error: `Fiş bulunamadı: ${no}` }, { status: 404 })
    return NextResponse.json({ ok: true, fis })
  } catch (e) {
    return hata(e)
  }
}
