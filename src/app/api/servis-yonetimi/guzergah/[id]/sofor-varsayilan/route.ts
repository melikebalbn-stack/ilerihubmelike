import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisGuzergahSoforVarsayilan, listServisGuzergahSoforVarsayilanlari } from '@/lib/servis-yonetimi/service'
import type { ServisGuzergahSoforVarsayilanForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisGuzergahSoforVarsayilanlari(guzergahId, { aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Varsayılan şoför listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Varsayılan şoför listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const body = (await request.json()) as Omit<ServisGuzergahSoforVarsayilanForm, 'guzergahId'>
    const data = await createServisGuzergahSoforVarsayilan({ ...body, guzergahId }, userId)
    return NextResponse.json({ ok: true, message: 'Varsayılan şoför ataması oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Varsayılan şoför oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Varsayılan şoför ataması oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
