import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { geriAlStokHareket } from '@/lib/envanter/service'

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (!body.hareketId) {
      return NextResponse.json({ ok: false, message: 'Hareket ID gerekli.' }, { status: 400 })
    }
    const result = await geriAlStokHareket(body.hareketId)
    return NextResponse.json({ ok: true, message: 'Hareket geri alındı.', data: result })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'Geri alınamadı.',
      },
      { status: 400 },
    )
  }
}
