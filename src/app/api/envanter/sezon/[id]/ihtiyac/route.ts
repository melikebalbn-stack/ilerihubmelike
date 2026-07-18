import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { hesaplaIhtiyac } from '@/lib/envanter/sezon'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const { id } = await params
    const data = await hesaplaIhtiyac(id)

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'İhtiyaç hesaplanamadı.' },
      { status: 400 },
    )
  }
}
