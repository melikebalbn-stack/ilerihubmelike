import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateServisGuzergah } from '@/lib/servis-yonetimi/service'
import type { ServisGuzergahForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id } = await params
    const guzergah = await prisma.servisGuzergah.findUnique({
      where: { id },
      include: { yerleske: { select: { id: true, kod: true, ad: true } } },
    })
    if (!guzergah) {
      return NextResponse.json({ ok: false, message: 'Güzergâh bulunamadı.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: guzergah })
  } catch (err) {
    console.error('Servis güzergâh detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Güzergâh detayı alınamadı.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as ServisGuzergahForm
    const data = await updateServisGuzergah(id, body)
    return NextResponse.json({ ok: true, message: 'Güzergâh güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Güzergâh güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
