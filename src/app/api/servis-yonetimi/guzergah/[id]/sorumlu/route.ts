import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisSorumlusu, listServisSorumlulari } from '@/lib/servis-yonetimi/service'
import type { ServisSorumlusuForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const durum = request.nextUrl.searchParams.get('durum')
    const aktif = durum === 'aktif' ? true : durum === 'pasif' ? false : undefined
    const data = await listServisSorumlulari(guzergahId, { aktif })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Servis sorumlusu listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Servis sorumlusu listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.sorumlu.manage')
  if (error) return error
  try {
    const { id: guzergahId } = await params
    const body = (await request.json()) as Omit<ServisSorumlusuForm, 'guzergahId'>
    const data = await createServisSorumlusu({ ...body, guzergahId }, userId)
    return NextResponse.json({ ok: true, message: 'Servis sorumlusu ataması oluşturuldu.', data }, { status: 201 })
  } catch (err) {
    console.error('Servis sorumlusu oluşturma hatası:', err)
    const message = err instanceof Error ? err.message : 'Servis sorumlusu ataması oluşturulurken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
