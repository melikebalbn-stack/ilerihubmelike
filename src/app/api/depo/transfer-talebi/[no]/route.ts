import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { talepGetir } from '@/lib/ifs/transfer-talebi'
import { GUARD, hata, talepNo } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/transfer-talebi/{no} → { ok, talep } (başlık + istenen + seçili stoklar). SADECE OKUMA.
export async function GET(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const no = talepNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz talep no' }, { status: 400 })
  try {
    const talep = await talepGetir(no)
    if (!talep) return NextResponse.json({ ok: false, error: `Talep bulunamadı: ${no}` }, { status: 404 })
    return NextResponse.json({ ok: true, talep })
  } catch (e) {
    return hata(e)
  }
}
