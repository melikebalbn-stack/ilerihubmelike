import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { updateServisSofor } from '@/lib/servis-yonetimi/service'
import type { ServisSoforForm } from '@/lib/servis-yonetimi/validation'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { error } = await requirePermission('servis.view')
  if (error) return error

  try {
    const { id } = await context.params
    const data = await prisma.servisSofor.findUnique({
      where: { id },
      include: { firma: { select: { id: true, ad: true, aktif: true } } },
    })
    return data
      ? NextResponse.json({ ok: true, data })
      : NextResponse.json({ ok: false, message: 'Şoför bulunamadı.' }, { status: 404 })
  } catch (err) {
    console.error('Servis şoför detay hatası:', err)
    return NextResponse.json({ ok: false, message: 'Şoför detayı alınamadı.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error } = await requirePermission('servis.tanim.manage')
  if (error) return error

  try {
    const { id } = await context.params
    const body = (await request.json()) as ServisSoforForm
    return NextResponse.json({ ok: true, data: await updateServisSofor(id, body) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Şoför güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
