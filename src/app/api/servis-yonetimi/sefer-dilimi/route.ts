import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisSeferDilimi, listServisSeferDilimleri } from '@/lib/servis-yonetimi/service'
import type { ServisSeferDilimiForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisSeferDilimleri({ aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis sefer dilimi listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Sefer dilimi listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const body = (await request.json()) as ServisSeferDilimiForm
    const data = await createServisSeferDilimi(body, userId)
    return NextResponse.json({ ok: true, message: 'Sefer dilimi başarıyla oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis sefer dilimi oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Sefer dilimi oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
