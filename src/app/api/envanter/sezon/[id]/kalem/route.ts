import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { addSezonKalem } from '@/lib/envanter/sezon'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const kalem = await addSezonKalem(id, body.urunId, Number(body.kisiBasiAdet))

    return NextResponse.json(
      { ok: true, message: 'Kalem eklendi.', data: kalem },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Kalem eklenemedi.' },
      { status: 400 },
    )
  }
}
