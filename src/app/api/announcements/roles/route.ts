import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/announcements/roles
 *
 * Duyuru oluşturma formundaki audience seçimi için minimal rol listesi
 * (slug + name). /api/roles SUPER_ADMIN-only olduğu için duyuru-yetkili
 * kullanıcıların (admin veya create) ayrı bir kapısı.
 *
 * Permission: duyuru.admin VEYA duyuru.create.
 */
export async function GET() {
  const { session, error } = await requireUser()
  if (error) return error

  const perms = session.user.permissions ?? []
  if (!perms.includes('duyuru.admin') && !perms.includes('duyuru.create')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const roles = await prisma.role.findMany({
    select: { id: true, slug: true, name: true, isSystem: true },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json({ roles })
}
