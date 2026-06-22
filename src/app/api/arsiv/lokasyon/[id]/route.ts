/**
 * PATCH /api/arsiv/lokasyon/[id] -> sadece SUPER_ADMIN
 *
 * - Adres alanları (depoNo/rafKodu/siraNo) değiştirilemez (composite unique).
 *   Değiştirmek isteniyorsa yeni lokasyon oluşturulur, eski deaktive edilir.
 * - mevcutDoluluk runtime-managed, manuel update edilmez.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
} from '@/lib/arsiv-auth'

export const dynamic = 'force-dynamic'

type UpdateLokasyonInput = {
  kapasite?: number
  aciklama?: string | null
  aktifMi?: boolean
}

function validateUpdate(body: unknown): UpdateLokasyonInput | string {
  if (!body || typeof body !== 'object') return 'JSON body bekleniyor'
  const b = body as Record<string, unknown>
  const out: UpdateLokasyonInput = {}
  if (b.kapasite !== undefined) {
    if (!Number.isInteger(b.kapasite) || (b.kapasite as number) < 1) {
      return 'kapasite: pozitif tamsayı'
    }
    out.kapasite = b.kapasite as number
  }
  if (b.aciklama !== undefined) {
    if (b.aciklama !== null && (typeof b.aciklama !== 'string' || b.aciklama.length > 250)) {
      return 'aciklama: en fazla 250 karakter veya null'
    }
    out.aciklama = b.aciklama as string | null
  }
  if (b.aktifMi !== undefined) {
    if (typeof b.aktifMi !== 'boolean') return 'aktifMi: boolean'
    out.aktifMi = b.aktifMi
  }
  return out
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()
  if (!ctx.isSuperAdmin) return forbidden('Lokasyon güncelleme SUPER_ADMIN gerektirir')

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!Number.isInteger(id) || id < 1) return badRequest('Geçersiz id')

  let body
  try {
    body = await req.json()
  } catch {
    return badRequest('Geçerli JSON gönderilmedi')
  }
  const parsed = validateUpdate(body)
  if (typeof parsed === 'string') return badRequest(parsed)

  try {
    const updated = await prisma.arsivLokasyon.update({ where: { id }, data: parsed })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2025') return notFound('Lokasyon')
    throw e
  }
}
