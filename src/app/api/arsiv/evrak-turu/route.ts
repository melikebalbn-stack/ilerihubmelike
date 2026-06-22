/**
 * GET /api/arsiv/evrak-turu
 *   - Default: kullanıcının kendi bolum'unun türleri (SUPER_ADMIN: tümü)
 *   - Query: ?bolumId=N -> SUPER_ADMIN için filtre, diğerleri için 403
 *   - Query: ?aktif=true|false (default: true)
 *
 * POST /api/arsiv/evrak-turu
 *   - Body.bolumId zorunlu
 *   - Kullanıcı kendi bolum'una ekleyebilir; SUPER_ADMIN herhangi bir bolum'a
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  unauthorized,
  forbidden,
  badRequest,
  canAccessBolum,
} from '@/lib/arsiv-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { searchParams } = new URL(req.url)
  const aktifParam = searchParams.get('aktif')
  const aktifMi = aktifParam === null ? true : aktifParam === 'true'

  const bolumIdParam = searchParams.get('bolumId')
  let bolumIdFilter: number | undefined

  if (bolumIdParam) {
    const parsed = Number(bolumIdParam)
    if (!Number.isInteger(parsed) || parsed < 1) return badRequest('Geçersiz bolumId')
    if (!ctx.isSuperAdmin && parsed !== ctx.arsivBolumId) {
      return forbidden("Başka bolum'un evrak türlerini göremezsiniz")
    }
    bolumIdFilter = parsed
  } else if (!ctx.isSuperAdmin) {
    if (ctx.arsivBolumId === null) {
      return NextResponse.json({
        items: [],
        uyari: "Bolum'unuz arşiv sistemine tanımlı değil",
      })
    }
    bolumIdFilter = ctx.arsivBolumId
  }
  // SUPER_ADMIN + filtre yok -> tüm bolum'lar

  const items = await prisma.arsivEvrakTuru.findMany({
    where: { aktifMi, ...(bolumIdFilter ? { bolumId: bolumIdFilter } : {}) },
    orderBy: [{ bolumId: 'asc' }, { ad: 'asc' }],
  })

  return NextResponse.json({ items })
}

type CreateEvrakTuruInput = {
  bolumId: number
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak?: string
}

function validateCreate(body: unknown): CreateEvrakTuruInput | string {
  if (!body || typeof body !== 'object') return 'JSON body bekleniyor'
  const b = body as Record<string, unknown>
  if (!Number.isInteger(b.bolumId) || (b.bolumId as number) < 1) {
    return 'bolumId: pozitif tamsayı zorunlu'
  }
  if (typeof b.ad !== 'string' || b.ad.length < 1 || b.ad.length > 150) {
    return 'ad: 1-150 karakter zorunlu'
  }
  const saklama = b.varsayilanSaklamaYili
  let saklamaVal = 10
  if (saklama !== undefined) {
    if (!Number.isInteger(saklama) || (saklama as number) < 1 || (saklama as number) > 100) {
      return 'varsayilanSaklamaYili: 1-100 arası tamsayı'
    }
    saklamaVal = saklama as number
  }
  if (b.yasalDayanak !== undefined && (typeof b.yasalDayanak !== 'string' || b.yasalDayanak.length > 250)) {
    return 'yasalDayanak: en fazla 250 karakter'
  }
  return {
    bolumId: b.bolumId as number,
    ad: b.ad,
    varsayilanSaklamaYili: saklamaVal,
    yasalDayanak: b.yasalDayanak as string | undefined,
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  let body
  try {
    body = await req.json()
  } catch {
    return badRequest('Geçerli JSON gönderilmedi')
  }
  const parsed = validateCreate(body)
  if (typeof parsed === 'string') return badRequest(parsed)

  if (!canAccessBolum(ctx, parsed.bolumId)) {
    return forbidden("Sadece kendi bolum'unuza evrak türü ekleyebilirsiniz")
  }

  try {
    const created = await prisma.arsivEvrakTuru.create({
      data: { ...parsed, aktifMi: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'P2002') {
      return NextResponse.json(
        { error: "Bu bolum'da aynı isimli evrak türü zaten var" },
        { status: 409 }
      )
    }
    if (code === 'P2003') {
      return NextResponse.json(
        { error: 'Geçersiz bolumId (FK ihlali)' },
        { status: 400 }
      )
    }
    throw e
  }
}
