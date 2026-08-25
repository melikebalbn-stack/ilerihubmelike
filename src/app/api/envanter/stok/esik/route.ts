import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { updateStokEsik } from '@/lib/envanter/service'
import { envanterHataMesaji } from '@/lib/envanter/hata'

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
    const toNum = (v: unknown) =>
      v === '' || v === null || v === undefined ? null : Number(v)
    const result = await updateStokEsik({
      stokId: body.stokId,
      minStok: toNum(body.minStok),
        kritikStok: toNum(body.kritikStok),
        actorId: session.user.id,
        actorAd: session.user.name || session.user.email || 'Bilinmiyor',
      })
    return NextResponse.json({ ok: true, message: 'Eşik güncellendi.', data: result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Güncellenemedi.') },
      { status: 400 },
    )
  }
}
