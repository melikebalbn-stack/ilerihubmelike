import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { createServisGuzergahDurak, listServisGuzergahDuraklar } from '@/lib/servis-yonetimi/service'
import type { ServisGuzergahDurakForm } from '@/lib/servis-yonetimi/validation'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id } = await params
    const saatlerPasifDahil = request.nextUrl.searchParams.get('saatlerPasifDahil') === 'true'
    const data = await listServisGuzergahDuraklar(id, { saatlerPasifDahil })
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    console.error('Güzergâh durak listeleme hatası:', err)
    return NextResponse.json({ ok: false, message: 'Durak listesi alınırken hata oluştu.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as ServisGuzergahDurakForm
    const data = await createServisGuzergahDurak(id, body, userId)
    return NextResponse.json({ ok: true, message: 'Durak güzergaha eklendi.', data }, { status: 201 })
  } catch (err) {
    console.error('Güzergâh durak ekleme hatası:', err)
    const message = err instanceof Error ? err.message : 'Durak güzergaha eklenirken hata oluştu.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
