import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisFirma, listServisFirmalar } from '@/lib/servis-yonetimi/service'
import type { ServisFirmaForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisFirmalar({ aktif })

    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis firma listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Firma listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const body = (await request.json()) as ServisFirmaForm
    const data = await createServisFirma(body, userId)

    return NextResponse.json({ ok: true, message: 'Firma başarıyla oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis firma oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Firma oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
