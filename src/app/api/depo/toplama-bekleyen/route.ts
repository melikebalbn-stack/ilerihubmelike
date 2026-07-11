import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getBekleyenToplamaIsleri } from '@/lib/ifs/tuketim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/toplama-bekleyen → açık kalemli Released/Started iş emirleri.
// Guard: admin.system.manage. SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error

  try {
    const isler = await getBekleyenToplamaIsleri()
    return NextResponse.json({ ok: true, isler })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
