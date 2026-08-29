import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { yenidenSiralaServisGuzergahDuraklar } from '@/lib/servis-yonetimi/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const body = (await request.json()) as { guzergahDurakIdleri?: unknown }
    if (!Array.isArray(body.guzergahDurakIdleri) || body.guzergahDurakIdleri.some((x) => typeof x !== 'string')) {
      return NextResponse.json({ ok: false, message: 'guzergahDurakIdleri[] gerekli.' }, { status: 400 })
    }
    const data = await yenidenSiralaServisGuzergahDuraklar(guzergahId, body.guzergahDurakIdleri as string[])
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sıralama kaydedilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
