import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { sevkLokasyonlari } from '@/lib/ifs/sevkiyat'
import { GUARD, hata } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sevkiyat/lokasyonlar → { ok, lokasyonlar } (sevkiyat ambarı lokasyonları). SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  try {
    return NextResponse.json({ ok: true, lokasyonlar: await sevkLokasyonlari() })
  } catch (e) {
    return hata(e)
  }
}
