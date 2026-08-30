import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateServisArac } from '@/lib/servis-yonetimi/service'
import type { ServisAracForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id } = await params
    const arac = await prisma.servisArac.findUnique({
      where: { id },
      include: { firma: { select: { id: true, ad: true, aktif: true } } },
    })
    if (!arac) {
      return NextResponse.json({ ok: false, message: 'Araç bulunamadı.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: arac })
  } catch (err) {
    console.error('Servis araç detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Araç detayı alınamadı.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as ServisAracForm
    const data = await updateServisArac(id, body, userId)
    return NextResponse.json({ ok: true, message: 'Araç güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Araç güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
