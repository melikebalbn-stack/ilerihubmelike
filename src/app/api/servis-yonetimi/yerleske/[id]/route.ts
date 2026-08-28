import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { updateServisYerleske } from '@/lib/servis-yonetimi/service'
import type { ServisYerleskeForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('servis.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const yerleske = await prisma.servisYerleske.findUnique({ where: { id } })
    if (!yerleske) {
      return NextResponse.json({ ok: false, message: 'Yerleşke bulunamadı.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: yerleske })
  } catch (err) {
    console.error('Servis yerleşke detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Yerleşke detayı alınamadı.' }, { status: 500 })
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
    const body = (await request.json()) as ServisYerleskeForm
    const data = await updateServisYerleske(id, body)

    return NextResponse.json({ ok: true, message: 'Yerleşke güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Yerleşke güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
