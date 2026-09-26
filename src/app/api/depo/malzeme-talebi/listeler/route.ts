import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { degerListeleri } from '@/lib/ifs/malzeme-talebi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/malzeme-talebi/listeler → { ok, musteriler, varisYerleri }. SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await degerListeleri()) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS verisi alınamadı' }, { status: 502 })
  }
}
