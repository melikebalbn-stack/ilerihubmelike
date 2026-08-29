import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateServisFirma } from '@/lib/servis-yonetimi/service'
import type { ServisFirmaForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
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
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
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
