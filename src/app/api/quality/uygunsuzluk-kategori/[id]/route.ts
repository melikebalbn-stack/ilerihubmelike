import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/quality/uygunsuzluk-kategori/[id] — aktif/pasif değiştir ya da adını düzenle.
 * Auth: canManageUygunsuzluk. Silme YOK (kullanımdaki kategori Restrict ile zaten korunuyor,
 * HataKodu desenindeki gibi pasifleştirme ile kaldırılır).
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'Kategori düzenleme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const body = await request.json().catch(() => null)
  const data: { ad?: string; aktif?: boolean } = {}
  if (typeof body?.ad === 'string' && body.ad.trim()) data.ad = body.ad.trim()
  if (typeof body?.aktif === 'boolean') data.aktif = body.aktif

  const mevcut = await prisma.kaliteUygunsuzlukKategori.findUnique({ where: { id } })
  if (!mevcut) return NextResponse.json({ error: 'Kategori bulunamadı' }, { status: 404 })

  const kategori = await prisma.kaliteUygunsuzlukKategori.update({ where: { id }, data })
  return NextResponse.json(kategori)
}
