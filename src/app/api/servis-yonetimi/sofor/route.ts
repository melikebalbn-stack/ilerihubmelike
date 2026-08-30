import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisSofor, listServisSoforler } from '@/lib/servis-yonetimi/service'
import type { ServisSoforForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error

  try {
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisSoforler({ aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis şoför listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Şoför listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error

  try {
    const body = (await request.json()) as ServisSoforForm
    const data = await createServisSofor(body, userId)
    return NextResponse.json({ ok: true, message: 'Şoför başarıyla oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Şoför oluşturulamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
