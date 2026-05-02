/**
 * PATCH /api/arsiv/evrak-turu/[id]
 *   - bolumId DEĞİŞTİRİLEMEZ (taşıma yapılmaz; yeni türle baştan oluştur)
 *   - Kullanıcı kendi bolum'ununkini düzenler; SUPER_ADMIN tümünü
 *
 * DELETE /api/arsiv/evrak-turu/[id]
 *   - Hard delete YOK (FK koli/alt-koli). Soft delete: aktifMi=false
 *   - Aynı yetki kuralları
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getArsivUserContext,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  canAccessBolum,
} from '@/lib/arsiv-auth'

export const dynamic = 'force-dynamic'

type UpdateEvrakTuruInput = {
  ad?: string
  varsayilanSaklamaYili?: number
  yasalDayanak?: string | null
  aktifMi?: boolean
}

function validateUpdate(body: unknown): UpdateEvrakTuruInput | string {
  if (!body || typeof body !== 'object') return 'JSON body bekleniyor'
  const b = body as Record<string, unknown>
  const out: UpdateEvrakTuruInput = {}
  if (b.ad !== undefined) {
    if (typeof b.ad !== 'string' || b.ad.length < 1 || b.ad.length > 150) {
      return 'ad: 1-150 karakter'
    }
    out.ad = b.ad
  }
  if (b.varsayilanSaklamaYili !== undefined) {
    const v = b.varsayilanSaklamaYili
    if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 100) {
      return 'varsayilanSaklamaYili: 1-100 arası tamsayı'
    }
    out.varsayilanSaklamaYili = v as number
  }
  if (b.yasalDayanak !== undefined) {
    if (b.yasalDayanak !== null && (typeof b.yasalDayanak !== 'string' || b.yasalDayanak.length > 250)) {
      return 'yasalDayanak: en fazla 250 karakter veya null'
    }
    out.yasalDayanak = b.yasalDayanak as string | null
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

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!Number.isInteger(id) || id < 1) return badRequest('Geçersiz id')

  const mevcut = await prisma.arsivEvrakTuru.findUnique({
    where: { id },
    select: { id: true, bolumId: true },
  })
  if (!mevcut) return notFound('Evrak türü')

  if (!canAccessBolum(ctx, mevcut.bolumId)) {
    return forbidden('Bu evrak türünü düzenleyemezsiniz')
  }

  let body
  try {
    body = await req.json()
  } catch {
    return badRequest('Geçerli JSON gönderilmedi')
  }
  const parsed = validateUpdate(body)
  if (typeof parsed === 'string') return badRequest(parsed)

  try {
    const updated = await prisma.arsivEvrakTuru.update({ where: { id }, data: parsed })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: "Bu bolum'da aynı isimli evrak türü zaten var" },
        { status: 409 }
      )
    }
    throw e
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!Number.isInteger(id) || id < 1) return badRequest('Geçersiz id')

  const mevcut = await prisma.arsivEvrakTuru.findUnique({
    where: { id },
    select: { id: true, bolumId: true, aktifMi: true },
  })
  if (!mevcut) return notFound('Evrak türü')

  if (!canAccessBolum(ctx, mevcut.bolumId)) {
    return forbidden('Bu evrak türünü silemezsiniz')
  }

  if (!mevcut.aktifMi) {
    return NextResponse.json(
      { error: 'Evrak türü zaten deaktif' },
      { status: 409 }
    )
  }

  // Soft delete
  const updated = await prisma.arsivEvrakTuru.update({
    where: { id },
    data: { aktifMi: false },
  })
  return NextResponse.json(updated)
}
