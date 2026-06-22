import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { PermissionsMatrix } from '@/components/settings/permissions-matrix'

interface PageProps {
  searchParams: Promise<{ module?: string }>
}

export default async function IzinMatrisiPage({ searchParams }: PageProps) {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const { module: moduleParam } = await searchParams

  const [roles, permissions, rolePermissions] = await Promise.all([
    prisma.role.findMany({
      select: { id: true, slug: true, name: true, isSystem: true, isProtected: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    }),
    prisma.permission.findMany({
      select: { id: true, key: true, description: true, module: true },
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    }),
    prisma.rolePermission.findMany({
      select: { roleId: true, permissionId: true },
    }),
  ])

  const modules = Array.from(new Set(permissions.map((p) => p.module))).sort()
  const initialMatrix: Record<string, string[]> = Object.fromEntries(
    roles.map((r) => [r.id, [] as string[]])
  )
  for (const rp of rolePermissions) {
    if (initialMatrix[rp.roleId]) initialMatrix[rp.roleId].push(rp.permissionId)
  }

  const initialModule =
    moduleParam && modules.includes(moduleParam) ? moduleParam : modules[0]

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-[1400px]">
      <nav className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
        <Link href="/settings" className="hover:text-foreground">Ayarlar</Link>
        <ChevronRight className="h-4 w-4" />
        <span>Yetkilendirme</span>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/roller" className="hover:text-foreground">Roller</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">İzin matrisi</span>
      </nav>

      <PermissionsMatrix
        roles={roles}
        permissions={permissions}
        modules={modules}
        initialMatrix={initialMatrix}
        initialModule={initialModule}
      />
    </div>
  )
}
