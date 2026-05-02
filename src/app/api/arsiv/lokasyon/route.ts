/**
 * GET /api/arsiv/lokasyon  -> tüm aktif kullanıcılar
 * POST /api/arsiv/lokasyon -> sadece SUPER_ADMIN
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  unauthorized,
  forbidden,
  badRequest,
} from '@/lib/arsiv-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const lokasyonlar = await prisma.arsivLokasyon.findMany({
    where: { aktifMi: true },
    orderBy: [{ depoNo: 'asc' }, { rafKodu: 'asc' }, { siraNo: 'asc' }],
  })
  return NextResponse.json({ items: lokasyonlar })
}

type CreateLokasyonInput = {
  depoNo: string
  rafKodu: string
  siraNo: number
  kapasite?: number
  aciklama?: string
}

function validateCreate(body: unknown): CreateLokasyonInput | string {
  if (!body || typeof body !== 'object') return 'JSON body bekleniyor'
  const b = body as Record<string, unknown>
  if (typeof b.depoNo !== 'string' || b.depoNo.length < 1 || b.depoNo.length > 20) {
    return 'depoNo: 1-20 karakter zorunlu'
  }
  if (typeof b.rafKodu !== 'string' || b.rafKodu.length < 1 || b.rafKodu.length > 20) {
    return 'rafKodu: 1-20 karakter zorunlu'
  }
  if (!Number.isInteger(b.siraNo) || (b.siraNo as number) < 1) {
    return 'siraNo: pozitif tamsayı zorunlu'
  }
  if (b.kapasite !== undefined && (!Number.isInteger(b.kapasite) || (b.kapasite as number) < 1)) {
    return 'kapasite: pozitif tamsayı'
  }
  if (b.aciklama !== undefined && (typeof b.aciklama !== 'string' || b.aciklama.length > 250)) {
    return 'aciklama: en fazla 250 karakter'
  }
  return {
    depoNo: b.depoNo,
    rafKodu: b.rafKodu,
    siraNo: b.siraNo as number,
    kapasite: (b.kapasite as number | undefined) ?? 50,
    aciklama: b.aciklama as string | undefined,
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()
  if (!ctx.isSuperAdmin) return forbidden('Lokasyon ekleme SUPER_ADMIN gerektirir')

  let body
  try {
    body = await req.json()
  } catch {
    return badRequest('Geçerli JSON gönderilmedi')
  }
  const parsed = validateCreate(body)
  if (typeof parsed === 'string') return badRequest(parsed)

  try {
    const lokasyon = await prisma.arsivLokasyon.create({
      data: { ...parsed, mevcutDoluluk: 0, aktifMi: true },
    })
    return NextResponse.json(lokasyon, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu adres kombinasyonu zaten kayıtlı' },
        { status: 409 }
      )
    }
    throw e
  }
}
