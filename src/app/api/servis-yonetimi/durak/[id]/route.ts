import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateServisDurak } from '@/lib/servis-yonetimi/service'
import type { ServisDurakForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id } = await params
    const durak = await prisma.servisDurak.findUnique({ where: { id } })
    if (!durak) {
      return NextResponse.json({ ok: false, message: 'Durak bulunamadı.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: durak })
  } catch (err) {
    console.error('Servis durak detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Durak detayı alınamadı.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as ServisDurakForm
    const data = await updateServisDurak(id, body)
    return NextResponse.json({ ok: true, message: 'Durak güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Durak güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
