import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { createServisGuzergah, listServisGuzergahlar } from '@/lib/servis-yonetimi/service'
import type { ServisGuzergahForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('servis.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisGuzergahlar({ aktif })

    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis güzergâh listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Güzergâh listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('servis.tanim.manage')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const body = (await request.json()) as ServisGuzergahForm
    const data = await createServisGuzergah(body)
    return NextResponse.json({ ok: true, message: 'Güzergâh başarıyla oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis güzergâh oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Güzergâh oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
