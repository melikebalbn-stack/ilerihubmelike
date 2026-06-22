import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, ChevronRight, ShieldCheck, Grid3x3, Users, Network } from 'lucide-react'
import { getRoleVisual } from '@/lib/role-visuals'

export default async function RollerPage() {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { userRoles: true, rolePermissions: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })

  const totalRoles = roles.length
  const totalAssignments = roles.reduce((sum, r) => sum + r._count.userRoles, 0)
  const unassignedCount = roles.filter((r) => r._count.userRoles === 0).length

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <nav className="text-sm text-muted-foreground flex items-center gap-2">
        <Link href="/settings" className="hover:text-foreground">Ayarlar</Link>
        <ChevronRight className="h-4 w-4" />
        <span>Yetkilendirme</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Roller</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-teal-600" />
            Roller
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalRoles} sistem rolü ve atanmış kullanıcıları yönet
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/kullanici-rolleri">
              <Users className="h-4 w-4 mr-2" />
              Kullanıcı rolleri
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/izin-matrisi">
              <Grid3x3 className="h-4 w-4 mr-2" />
              İzin matrisi
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/azure-ad-mapping">
              <Network className="h-4 w-4 mr-2" />
              AD Grup Mapping
            </Link>
          </Button>
          <Button
            disabled
            title="Custom rol oluşturma sonraki sürümde — şu an 9 sistem rolü kullanılıyor"
          >
            <Plus className="h-4 w-4 mr-2" />
            Yeni rol
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Toplam rol</div>
            <div className="text-2xl font-bold mt-1">{totalRoles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Aktif atama</div>
            <div className="text-2xl font-bold mt-1">{totalAssignments}</div>
          </CardContent>
        </Card>
        <Card className={unassignedCount > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Atanmamış rol</div>
            <div
              className={`text-2xl font-bold mt-1 ${
                unassignedCount > 0 ? 'text-amber-700' : ''
              }`}
            >
              {unassignedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead className="text-right">İzin sayısı</TableHead>
                <TableHead className="text-right">Kullanıcı sayısı</TableHead>
                <TableHead className="text-right">Aksiyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => {
                const isUnassigned = r._count.userRoles === 0
                const visual = getRoleVisual(r.slug)
                const Icon = visual.Icon
                return (
                  <TableRow
                    key={r.id}
                    className={isUnassigned ? 'bg-amber-50 hover:bg-amber-100' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${visual.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {r.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.isSystem && <Badge variant="secondary">Sistem</Badge>}
                        {r.isProtected && (
                          <Badge variant="outline">Korumalı</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r._count.rolePermissions}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isUnassigned ? (
                        <span className="text-amber-700 font-semibold">0</span>
                      ) : (
                        r._count.userRoles
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isUnassigned ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/settings/kullanici-rolleri?roleId=${r.id}`}>
                            Ata
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/settings/roller/${r.id}`}>Görüntüle</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {unassignedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Sarı satırlar atanmamış sistem rolleridir. Kullanıcı atama UI'sı PR-Y3d
          ile eklenecek.
        </p>
      )}
    </div>
  )
}
