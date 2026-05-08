import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'

/**
 * GET /api/users/roles
 * Paginated user listesi + atanmış roller. Search/filter destekli.
 * SUPER_ADMIN-only.
 *
 * Query params:
 * - search   : string (isim veya email contains, case-insensitive)
 * - roleId   : string (sadece bu role sahip kullanıcılar)
 * - page     : number (1-indexed, default 1)
 * - pageSize : number (default 20, max 100)
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error
  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Kullanıcı rol yönetimi için SUPER_ADMIN yetkisi gerekli' },
      { status: 403 }
    )
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() ?? ''
  const roleId = url.searchParams.get('roleId') ?? null
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(5, parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20)
  )
  const skip = (page - 1) * pageSize

  const where: Prisma.UserWhereInput = {}
  // Pasif user'lar da listelenir (frontend "Pasif" badge ile gösterir).
  // PATCH /api/users/[id]/roles zaten pasif user'a atama reddediyor — admin görür ama atayamaz.

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (roleId) {
    where.userRoles = { some: { roleId } }
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        jobTitle: true,
        department: true,
        userRoles: {
          select: {
            source: true,
            assignedAt: true,
            role: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      jobTitle: u.jobTitle,
      department: u.department,
      roles: u.userRoles.map((ur) => ({
        id: ur.role.id,
        slug: ur.role.slug,
        name: ur.role.name,
        source: ur.source,
        assignedAt: ur.assignedAt,
      })),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}
