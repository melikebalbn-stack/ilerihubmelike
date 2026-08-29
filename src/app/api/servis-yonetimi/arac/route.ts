import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisArac, listServisAraclar } from '@/lib/servis-yonetimi/service'
import type { ServisAracForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisAraclar({ aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis araç listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Araç listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const body = (await request.json()) as ServisAracForm
    const data = await createServisArac(body)
    return NextResponse.json({ ok: true, message: 'Araç başarıyla oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis araç oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Araç oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
