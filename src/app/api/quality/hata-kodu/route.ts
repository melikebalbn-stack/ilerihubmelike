import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageHataKodu } from '@/lib/quality/hata-kodu-access'
import { hataKoduCreateInput } from '@/lib/quality/hata-kodu-validators'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/hata-kodu — DÜZ hata kodu listesi. Auth: oturum (herkes okur).
 *
 * ?aktif=1 → yalnız aktif kodlar (varsayılan: hepsi)
 *
 * Hiyerarşi YOK: ağaç yanıtı ve `?duz` parametresi 2026-08-09'da kaldırıldı.
 * Sıralama kod artan. Sayfalama YOK — küme küçük (~126 satır).
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const yalnizAktif = request.nextUrl.searchParams.get('aktif') === '1'

  const items = await prisma.hataKodu.findMany({
    where: yalnizAktif ? { aktif: true } : undefined,
    orderBy: { kod: 'asc' },
  })

  return NextResponse.json({ items, total: items.length })
}

/**
 * POST /api/quality/hata-kodu — yeni kod. Auth: canManageHataKodu (quality.hatakodu.manage).
 * siraNo verilmezse kod değeri kullanılır.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageHataKodu(session)) {
    return NextResponse.json({ error: 'Hata kodu oluşturma yetkiniz yok' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = hataKoduCreateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  const mevcutKod = await prisma.hataKodu.findUnique({ where: { kod: d.kod }, select: { id: true } })
  if (mevcutKod) {
    return NextResponse.json({ error: `${d.kod} kodu zaten kayıtlı` }, { status: 409 })
  }

  const created = await prisma.hataKodu.create({
    data: {
      kod: d.kod,
      ad: d.ad,
      aktif: d.aktif ?? true,
      siraNo: d.siraNo ?? d.kod,
      aciklama: d.aciklama ?? null,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
