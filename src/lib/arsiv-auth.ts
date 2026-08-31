/**
 * Arşiv modülü yetki kontrol helper'ları.
 *
 * İki kademeli yetki:
 *   1. Aktif EMPLOYEE+ olmak
 *   2. Hedef kayıt'ın bolum'u = kullanıcının bolum'u
 *      (SUPER_ADMIN bu kontrolden muaf)
 *
 * Kullanıcının ArsivBolum ID'si Personnel.bolum → DepartmentDefinition.arsivBolumId
 * FK'sı ile bulunur. Karşılığı yoksa kullanıcı arşivde "yetkisiz" sayılır
 * (SUPER_ADMIN istisna).
 *
 * ESKİDEN: `ArsivBolum.findUnique({ where: { ad: Personnel.bolum } })` — yani METİN
 * eşleşmesi. 30.08.2026 Title-Case yeniden adlandırmasında ("KALİTE MÜDÜRLÜĞÜ" →
 * "Kalite Müdürlüğü") 28 aktif bölümden 26'sı eşleşmez oldu ve arşiv fiilen yalnız
 * SUPER_ADMIN'de kaldı. Ad eşleşmesi tamamen kaldırıldı; bağ artık FK.
 */

import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  // Kullanıcı + bağlı personelin bölümü TEK sorguda; ayrı resolveUserBolum çağrısı yok.
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      personnel: { select: { bolum: true } },
    },
  })
  if (!user || !user.isActive) return null

  const role = (user.role as string) || 'EMPLOYEE'
  const isSuperAdmin = role === 'SUPER_ADMIN'

  let arsivBolumId: number | null = null
  if (!isSuperAdmin) {
    const bolum = user.personnel?.bolum
    if (bolum) {
      // FK üzerinden: bölüm tanımı hangi arşiv kutusunu gösteriyorsa o.
      // DepartmentDefinition.name @unique — ad ile kayda erişmek kimlik araması,
      // ArsivBolum.ad ile YETKİ eşleşmesi DEĞİL.
      const dept = await prisma.departmentDefinition.findUnique({
        where: { name: bolum },
        select: { arsivBolumId: true },
      })
      arsivBolumId = dept?.arsivBolumId ?? null
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
