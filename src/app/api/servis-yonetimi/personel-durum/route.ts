import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisPersonelDurum, listServisPersonelDurumlari } from '@/lib/servis-yonetimi/service'
import type { ServisPersonelDurumForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const personnelId = request.nextUrl.searchParams.get('personnelId') || undefined
    const data = await listServisPersonelDurumlari({ personnelId, aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis personel durumu listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Servis kullanım durumu listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requirePermission('servis.create')
  if (error) return error
  try {
    const body = (await request.json()) as ServisPersonelDurumForm
    const data = await createServisPersonelDurum(body, userId)
    return NextResponse.json({ ok: true, message: 'Servis kullanım durumu kaydı oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis personel durumu oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Servis kullanım durumu kaydı oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
