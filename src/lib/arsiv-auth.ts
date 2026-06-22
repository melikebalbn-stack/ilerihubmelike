/**
 * Arşiv modülü yetki kontrol helper'ları.
 *
 * İki kademeli yetki:
 *   1. Aktif EMPLOYEE+ olmak
 *   2. Hedef kayıt'ın bolum'u = kullanıcının bolum'u
 *      (SUPER_ADMIN bu kontrolden muaf)
 *
 * Kullanıcının ArsivBolum ID'si Personnel.bolum üzerinden
 * resolveUserBolum + ArsivBolum.ad eşleşmesi ile bulunur.
 * Eşleşme yoksa kullanıcı arşivde "yetkisiz" sayılır (SUPER_ADMIN istisna).
 */

import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserBolum } from '@/lib/user-personnel'

export type ArsivUserContext = {
  userId: string
  email: string
  role: string
  isSuperAdmin: boolean
  /** ArsivBolum.id veya null. SUPER_ADMIN için null normal. */
  arsivBolumId: number | null
}

/**
 * Mevcut session'dan ArsivUserContext üretir.
 * Login değilse veya isActive=false ise null döner.
 */
export async function getArsivUserContext(): Promise<ArsivUserContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true, isActive: true },
  })
  if (!user || !user.isActive) return null

  const role = (user.role as string) || 'EMPLOYEE'
  const isSuperAdmin = role === 'SUPER_ADMIN'

  let arsivBolumId: number | null = null
  if (!isSuperAdmin) {
    const bolumStr = await resolveUserBolum(user.id)
    if (bolumStr) {
      const arsivBolum = await prisma.arsivBolum.findUnique({
        where: { ad: bolumStr },
        select: { id: true },
      })
      arsivBolumId = arsivBolum?.id ?? null
    }
  }

  return {
    userId: user.id,
    email: user.email,
    role,
    isSuperAdmin,
    arsivBolumId,
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
}

export function forbidden(reason?: string) {
  return NextResponse.json(
    { error: 'Bu işlem için yetkiniz yok', reason },
    { status: 403 }
  )
}

export function notFound(resource = 'Kayıt') {
  return NextResponse.json({ error: `${resource} bulunamadı` }, { status: 404 })
}

export function badRequest(error: unknown) {
  return NextResponse.json(
    { error: 'Geçersiz istek', detay: String(error) },
    { status: 400 }
  )
}

/**
 * Yardımcı: Bir kayıt'ın bolum'u kullanıcının bolum'u mu?
 * SUPER_ADMIN her zaman true döner.
 */
export function canAccessBolum(
  ctx: ArsivUserContext,
  resourceBolumId: number
): boolean {
  if (ctx.isSuperAdmin) return true
  return ctx.arsivBolumId === resourceBolumId
}
