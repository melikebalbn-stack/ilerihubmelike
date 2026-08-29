import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateServisYerleske } from '@/lib/servis-yonetimi/service'
import type { ServisYerleskeForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
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
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
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
