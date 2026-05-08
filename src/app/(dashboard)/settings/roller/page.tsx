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
import {
  Shield,
  Award,
  Server,
  GraduationCap,
  Users,
  ClipboardCheck,
  UserCog,
  User as UserIcon,
  Plus,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'

const ROLE_VISUAL: Record<string, { Icon: typeof Shield; tone: string }> = {
  'super-admin':       { Icon: Shield,         tone: 'text-red-600 bg-red-50' },
  'admin':             { Icon: Shield,         tone: 'text-blue-600 bg-blue-50' },
  'bgys-sorumlusu':    { Icon: Award,          tone: 'text-purple-600 bg-purple-50' },
  'it-admin':          { Icon: Server,         tone: 'text-indigo-600 bg-indigo-50' },
  'akademi-admin':     { Icon: GraduationCap,  tone: 'text-emerald-600 bg-emerald-50' },
  'hr-yoneticisi':     { Icon: Users,          tone: 'text-pink-600 bg-pink-50' },
  'kalite-yoneticisi': { Icon: ClipboardCheck, tone: 'text-amber-700 bg-amber-100' },
  'departman-muduru':  { Icon: UserCog,        tone: 'text-cyan-600 bg-cyan-50' },
  'kullanici':         { Icon: UserIcon,       tone: 'text-gray-600 bg-gray-100' },
}

const DEFAULT_VISUAL = { Icon: Shield, tone: 'text-gray-600 bg-gray-100' }

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
        <Button disabled title="PR-Y3b ile aktif olacak">
          <Plus className="h-4 w-4 mr-2" />
          Yeni rol
        </Button>
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
                const visual = ROLE_VISUAL[r.slug] ?? DEFAULT_VISUAL
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
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="PR-Y3d ile aktif olacak"
                        >
                          Ata
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          title="PR-Y3b ile aktif olacak"
                        >
                          Görüntüle
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
