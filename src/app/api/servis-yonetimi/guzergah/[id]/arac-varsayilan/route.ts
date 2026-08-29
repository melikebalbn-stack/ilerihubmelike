import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisGuzergahAracVarsayilan, listServisGuzergahAracVarsayilanlari } from '@/lib/servis-yonetimi/service'
import type { ServisGuzergahAracVarsayilanForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisGuzergahAracVarsayilanlari(guzergahId, { aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Varsayılan araç listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Varsayılan araç listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const body = (await request.json()) as Omit<ServisGuzergahAracVarsayilanForm, 'guzergahId'>
    const data = await createServisGuzergahAracVarsayilan({ ...body, guzergahId }, userId)
    return NextResponse.json({ ok: true, message: 'Varsayılan araç ataması oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Varsayılan araç oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Varsayılan araç ataması oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
