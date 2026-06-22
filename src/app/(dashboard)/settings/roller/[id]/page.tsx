import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Edit3,
  Trash2,
  Users,
  ShieldCheck,
  Layers,
  UserPlus,
  Calendar,
  KeyRound,
} from 'lucide-react'
import { getRoleVisual, moduleLabel } from '@/lib/role-visuals'
import { RoleEditDialog } from '@/components/settings/role-edit-dialog'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RoleDetailPage({ params }: PageProps) {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const { id } = await params

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: {
          permission: {
            select: { id: true, key: true, module: true, description: true },
          },
        },
      },
      userRoles: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
              department: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      },
    },
  })

  if (!role) notFound()

  const allPermissions = await prisma.permission.findMany({ select: { module: true } })
  const totalsByModule = allPermissions.reduce<Record<string, number>>((acc, p) => {
    acc[p.module] = (acc[p.module] ?? 0) + 1
    return acc
  }, {})
  const grantedByModule = role.rolePermissions.reduce<Record<string, number>>((acc, rp) => {
    acc[rp.permission.module] = (acc[rp.permission.module] ?? 0) + 1
    return acc
  }, {})
  const moduleStats = Object.keys(totalsByModule)
    .map((m) => ({ module: m, granted: grantedByModule[m] ?? 0, total: totalsByModule[m] }))
    .filter((s) => s.granted > 0)
    .sort((a, b) => b.granted - a.granted)

  const userCount = role.userRoles.length
  const permissionCount = role.rolePermissions.length
  const moduleCount = moduleStats.length
  const visual = getRoleVisual(role.slug)
  const Icon = visual.Icon

  const dateFmt = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <nav className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
        <Link href="/settings" className="hover:text-foreground">Ayarlar</Link>
        <ChevronRight className="h-4 w-4" />
        <span>Yetkilendirme</span>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/roller" className="hover:text-foreground">Roller</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{role.name}</span>
      </nav>

      <div>
        <Link
          href="/settings/roller"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Roller listesine dön
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${visual.tone}`}>
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{role.name}</h1>
                  {role.isSystem && <Badge variant="secondary">Sistem</Badge>}
                  {role.isProtected && <Badge variant="outline">Korumalı</Badge>}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground font-mono">
                  <KeyRound className="h-3 w-3" />
                  {role.slug}
                </div>
                {role.description && (
                  <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
                    {role.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RoleEditDialog
                role={{
                  id: role.id,
                  slug: role.slug,
                  name: role.name,
                  description: role.description,
                  isSystem: role.isSystem,
                }}
                trigger={
                  <Button variant="outline" size="sm">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Düzenle
                  </Button>
                }
              />
              <Button
                variant="outline"
                size="sm"
                disabled={role.isProtected || role.isSystem}
                title={
                  role.isProtected || role.isSystem
                    ? 'Sistem rolleri silinemez'
                    : 'Rolü sil'
                }
                className={
                  role.isProtected || role.isSystem ? 'opacity-40' : 'text-destructive'
                }
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Sil
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Oluşturma:</span>
              <span className="text-foreground">{dateFmt.format(role.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Son güncelleme:</span>
              <span className="text-foreground">{dateFmt.format(role.updatedAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={userCount === 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Atanmış kullanıcı</div>
                <div
                  className={`text-2xl font-bold mt-1 ${
                    userCount === 0 ? 'text-amber-700' : ''
                  }`}
                >
                  {userCount}
                </div>
              </div>
              <Users
                className={`h-8 w-8 ${
                  userCount === 0 ? 'text-amber-400' : 'text-muted-foreground/40'
                }`}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Aktif izin</div>
                <div className="text-2xl font-bold mt-1">{permissionCount}</div>
              </div>
              <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Kapsanan modül</div>
                <div className="text-2xl font-bold mt-1">{moduleCount}</div>
              </div>
              <Layers className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            İzinler ({permissionCount})
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/settings/izin-matrisi${
                moduleStats[0] ? `?module=${moduleStats[0].module}` : ''
              }`}
            >
              İzin matrisinde düzenle
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {moduleStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Bu role henüz izin atanmamış
            </p>
          ) : (
            <div className="space-y-3">
              {moduleStats.map((s) => {
                const pct = s.total === 0 ? 0 : (s.granted / s.total) * 100
                return (
                  <div key={s.module} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{moduleLabel(s.module)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.granted} / {s.total}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            Atanmış kullanıcılar ({userCount})
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`/settings/kullanici-rolleri?roleId=${role.id}`}>
              <UserPlus className="h-4 w-4 mr-2" />
              Kullanıcı ata
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {userCount === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="inline-flex p-3 rounded-full bg-amber-100">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Henüz kullanıcı atanmamış</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Kullanıcı listesinde bu role atama yapabilirsin
                </p>
              </div>
              <Button asChild>
                <Link href={`/settings/kullanici-rolleri?roleId=${role.id}`}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  İlk kullanıcıyı ata
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {role.userRoles.map((ur) => (
                <div
                  key={ur.user.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white text-xs font-bold flex-shrink-0">
                      {(ur.user.name ?? ur.user.email)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {ur.user.name ?? '(isimsiz)'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ur.user.email}
                        {ur.user.jobTitle && ` · ${ur.user.jobTitle}`}
                        {ur.user.department && ` · ${ur.user.department}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      {dateFmt.format(ur.assignedAt)}
                      {ur.source === 'azure_ad' && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Azure AD
                        </Badge>
                      )}
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={`/settings/kullanici-rolleri?search=${encodeURIComponent(
                          ur.user.email
                        )}`}
                        title="Kullanıcının tüm rollerini düzenlemek için listeye git"
                      >
                        Düzenle
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
