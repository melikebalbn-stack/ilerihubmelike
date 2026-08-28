import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { updateServisFirma } from '@/lib/servis-yonetimi/service'
import type { ServisFirmaForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('servis.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const firma = await prisma.servisFirma.findUnique({ where: { id } })
    if (!firma) {
      return NextResponse.json({ ok: false, message: 'Firma bulunamadı.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: firma })
  } catch (err) {
    console.error('Servis firma detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Firma detayı alınamadı.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('servis.tanim.manage')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = (await request.json()) as ServisFirmaForm
    const data = await updateServisFirma(id, body)

    return NextResponse.json({ ok: true, message: 'Firma güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
