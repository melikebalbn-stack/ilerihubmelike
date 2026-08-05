import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { updateStokMaliyet } from '@/lib/envanter/service'

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (!body.stokId) {
      return NextResponse.json({ ok: false, message: 'stokId gerekli.' }, { status: 400 })
    }
    const maliyet =
      body.birimMaliyet === '' || body.birimMaliyet === null || body.birimMaliyet === undefined
        ? null
        : Number(body.birimMaliyet)
    const result = await updateStokMaliyet({
      stokId: body.stokId,
      birimMaliyet: maliyet,
      paraBirimi: body.paraBirimi || 'TL',
    })
    return NextResponse.json({ ok: true, message: 'Maliyet güncellendi.', data: result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Güncellenemedi.' },
      { status: 400 },
    )
  }
}
