import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisDurak, listServisDuraklar } from '@/lib/servis-yonetimi/service'
import type { ServisDurakForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisDuraklar({ aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis durak listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Durak listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const body = (await request.json()) as ServisDurakForm
    const data = await createServisDurak(body)
    return NextResponse.json({ ok: true, message: 'Durak başarıyla oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis durak oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Durak oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
