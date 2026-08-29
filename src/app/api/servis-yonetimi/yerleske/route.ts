import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisYerleske, listServisYerleskeler } from '@/lib/servis-yonetimi/service'
import type { ServisYerleskeForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisYerleskeler({ aktif })

    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis yerleşke listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Yerleşke listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const body = (await request.json()) as ServisYerleskeForm
    const data = await createServisYerleske(body)

    return NextResponse.json({ ok: true, message: 'Yerleşke başarıyla oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis yerleşke oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Yerleşke oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
