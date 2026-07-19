import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { listTezgahlar } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/yonetim/tezgahlar → tüm tezgahlar (203 satır, sayfalama gereksiz)
export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, tezgahlar: await listTezgahlar() })
  } catch (e) {
    return iproHata(e, 'Tezgah listesi alınamadı')
  }
}
