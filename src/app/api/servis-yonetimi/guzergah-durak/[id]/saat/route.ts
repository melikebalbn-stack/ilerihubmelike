import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { guzergahDurakSaatiKaydet } from '@/lib/servis-yonetimi/service'
import type { ServisGuzergahDurakSaatForm } from '@/lib/servis-yonetimi/validation'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id: guzergahDurakId } = await params
    const body = (await request.json()) as ServisGuzergahDurakSaatForm
    const data = await guzergahDurakSaatiKaydet(guzergahDurakId, body, userId)
    return NextResponse.json({ ok: true, message: 'Saat kaydedildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Saat kaydedilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
