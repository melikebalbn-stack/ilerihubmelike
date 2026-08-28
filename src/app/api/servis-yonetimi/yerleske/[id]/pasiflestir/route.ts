import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { pasiflestirServisYerleske } from '@/lib/servis-yonetimi/service'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('servis.tanim.manage')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const data = await pasiflestirServisYerleske(id)
    return NextResponse.json({ ok: true, message: 'Yerleşke pasifleştirildi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Yerleşke pasifleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
