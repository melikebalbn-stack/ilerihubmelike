import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisGuzergah, listServisGuzergahlar } from '@/lib/servis-yonetimi/service'
import type { ServisGuzergahForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
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
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
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
