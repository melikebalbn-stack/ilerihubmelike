import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/uygunsuzluk-kategori — kategori listesi.
 * Auth: oturum (herkes okur — form seçicisi için).
 * ?hepsi=1 → pasifler de döner (yönetim ekranı); yoksa yalnız aktifler (form seçicisi).
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const hepsi = request.nextUrl.searchParams.get('hepsi') === '1'

  const items = await prisma.kaliteUygunsuzlukKategori.findMany({
    where: hepsi ? {} : { aktif: true },
    orderBy: [{ siraNo: 'asc' }, { ad: 'asc' }],
  })
  return NextResponse.json({ items })
}

/** POST /api/quality/uygunsuzluk-kategori — yeni kategori. Auth: canManageUygunsuzluk. */
export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'Kategori ekleme yetkiniz yok' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const ad = typeof body?.ad === 'string' ? body.ad.trim() : ''
  if (!ad) return NextResponse.json({ error: 'Kategori adı zorunlu' }, { status: 400 })

  const mevcut = await prisma.kaliteUygunsuzlukKategori.findUnique({ where: { ad } })
  if (mevcut) return NextResponse.json({ error: 'Bu kategori zaten var' }, { status: 400 })

  const siraMax = await prisma.kaliteUygunsuzlukKategori.aggregate({ _max: { siraNo: true } })
  const kategori = await prisma.kaliteUygunsuzlukKategori.create({
    data: { ad, siraNo: (siraMax._max.siraNo ?? 0) + 1 },
  })
  return NextResponse.json(kategori, { status: 201 })
}
