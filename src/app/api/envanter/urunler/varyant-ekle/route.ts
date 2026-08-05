import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { addVaryantToUrun } from '@/lib/envanter/service'

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (!body.urunId || !body.tip || !body.deger) {
      return NextResponse.json({ ok: false, message: 'urunId, tip ve deger gerekli.' }, { status: 400 })
    }
    const result = await addVaryantToUrun({
      urunId: body.urunId,
      tip: body.tip,
      deger: body.deger,
    })
    return NextResponse.json({ ok: true, message: 'Varyant eklendi.', data: result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Varyant eklenemedi.' },
      { status: 400 },
    )
  }
}
