/**
 * GET /api/arsiv/users/search?q=...&limit=20
 *   Aktif Azure AD kullanıcılarını isim/email/id'ye göre arar.
 *   Sorumlu kullanıcı select dropdown'ları için kullanılır.
 *
 * NOT: /api/users/search zaten var ama LDAP sonucu döndürüyor
 * (`ldap_${username}` formatlı id'ler, DB FK'leri için kullanılamaz).
 * Bu endpoint DB'den gerçek User.id döndürür — sorumluKullaniciId
 * için doğrudan POST /api/arsiv/koli'ye geçirilebilir.
 *
 * Auth: getArsivUserContext() — login zorunlu, bolum kontrolü YOK
 *       (herkes herkesi arayabilir, sorumlu seç için).
 *
 * - q: en az 2 karakter (altında boş array)
 * - limit: default 20, max 50
 * - azureAdId IS NOT NULL filter (mavi yaka çıkar)
 * - ILIKE name | email | id, ORDER BY name ASC
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getArsivUserContext, unauthorized } from '@/lib/arsiv-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getArsivUserContext()
  if (!ctx) return unauthorized()

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()

  const limitRaw = Number(searchParams.get('limit') ?? '20')
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(50, limitRaw) : 20

  if (q.length < 2) {
    return NextResponse.json({ items: [] })
  }

  const items = await prisma.user.findMany({
    where: {
      azureAdId: { not: null },
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: 'asc' },
    take: limit,
  })

  return NextResponse.json({ items })
}
