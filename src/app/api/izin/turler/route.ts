import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { izinHata, turKaydet, turListesi } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/izin/turler — tüm türler (yasal kilitli + şirkete özel) (izin.admin)
// POST /api/izin/turler — şirkete özel tür ekle (izin.admin)
export async function GET() {
  const { error } = await requirePermission(['izin.admin', 'izin.bakiye.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, turler: await turListesi() })
  } catch (e) {
    return izinHata(e, 'Türler alınamadı')
  }
}

export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('izin.admin')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, tur: await turKaydet(null, (await req.json()) ?? {}, userId) }, { status: 201 })
  } catch (e) {
    return izinHata(e, 'Tür eklenemedi')
  }
}
