import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { izinHata, turKaydet } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/izin/turler/:id — şirkete özel türü düzenle / pasife al (izin.admin). Yasal türler 400.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('izin.admin')
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, tur: await turKaydet(id, (await req.json()) ?? {}, userId) })
  } catch (e) {
    return izinHata(e, 'Tür kaydedilemedi')
  }
}
