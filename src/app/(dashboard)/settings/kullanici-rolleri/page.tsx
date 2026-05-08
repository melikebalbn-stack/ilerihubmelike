import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { UserRolesList } from '@/components/settings/user-roles-list'

interface PageProps {
  searchParams: Promise<{ roleId?: string; search?: string; page?: string }>
}

export default async function KullaniciRolleriPage({ searchParams }: PageProps) {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const params = await searchParams

  const allRoles = await prisma.role.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      isSystem: true,
      _count: { select: { userRoles: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })

  const unassignedRoles = allRoles.filter((r) => r._count.userRoles === 0)

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <nav className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
        <Link href="/settings" className="hover:text-foreground">Ayarlar</Link>
        <ChevronRight className="h-4 w-4" />
        <span>Yetkilendirme</span>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/roller" className="hover:text-foreground">Roller</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Kullanıcı rolleri</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-teal-600" />
          Kullanıcı rolleri
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aktif kullanıcılara rol ata, mevcut atamaları yönet
        </p>
      </div>

      <UserRolesList
        allRoles={allRoles.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          userCount: r._count.userRoles,
        }))}
        unassignedRoles={unassignedRoles.map((r) => ({ id: r.id, name: r.name }))}
        initialFilters={{
          search: params.search ?? '',
          roleId: params.roleId ?? '',
          page: parseInt(params.page ?? '1', 10) || 1,
        }}
      />
    </div>
  )
}
