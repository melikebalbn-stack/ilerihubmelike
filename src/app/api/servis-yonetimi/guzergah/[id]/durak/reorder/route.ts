import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { siraDegistirServisGuzergahDurak } from '@/lib/servis-yonetimi/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const body = (await request.json()) as { guzergahDurakId?: string; yon?: 'YUKARI' | 'ASAGI' }
    if (!body.guzergahDurakId || (body.yon !== 'YUKARI' && body.yon !== 'ASAGI')) {
      return NextResponse.json({ ok: false, message: 'Geçersiz parametre.' }, { status: 400 })
    }
    const data = await siraDegistirServisGuzergahDurak(guzergahId, body.guzergahDurakId, body.yon)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sıralama değiştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
