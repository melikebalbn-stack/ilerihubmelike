import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { guzergahDurakSaatiSil } from '@/lib/servis-yonetimi/service'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    await guzergahDurakSaatiSil(id)
    return NextResponse.json({ ok: true, message: 'Saat silindi.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Saat silinemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
