import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateServisSeferDilimi } from '@/lib/servis-yonetimi/service'
import type { ServisSeferDilimiForm } from '@/lib/servis-yonetimi/validation'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id } = await params
    const dilim = await prisma.servisSeferDilimi.findUnique({ where: { id } })
    if (!dilim) {
      return NextResponse.json({ ok: false, message: 'Sefer dilimi bulunamadı.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: dilim })
  } catch (err) {
    console.error('Servis sefer dilimi detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Sefer dilimi detayı alınamadı.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as ServisSeferDilimiForm
    const data = await updateServisSeferDilimi(id, body)
    return NextResponse.json({ ok: true, message: 'Sefer dilimi güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sefer dilimi güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
