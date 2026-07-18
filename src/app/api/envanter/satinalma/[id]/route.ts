import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { getTalepDetay } from '@/lib/envanter/satinalma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const { id } = await params
  const talep = await getTalepDetay(id)

  if (!talep) {
    return NextResponse.json({ ok: false, message: 'Talep bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: talep })
}
